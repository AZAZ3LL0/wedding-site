import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { parseContent } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import { createDb } from '$lib/server/db';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { rsvpPayloadSchema, type RsvpPayload } from '$lib/types';
import { findCompanion } from './repo';
import { rsvpClosesAt, submitRsvp, type SubmitContent } from './service';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

const base = parseContent(raw);

const content: SubmitContent = {
	event: base.event,
	menu: {
		multiSelect: false,
		courses: [
			{ id: 'plov', label: 'Плов' },
			{ id: 'fish', label: 'Судак' }
		],
		drinks: [
			{ id: 'tea', label: 'Чай' },
			{ id: 'juice', label: 'Сок' }
		]
	},
	registry: {
		title: 'Дворец бракосочетания',
		address: 'ул. Ленина, 1',
		gatherTime: '11:00',
		ceremonyTime: '11:30',
		mapUrl: 'https://yandex.ru/maps/',
		photos: []
	},
	transfer: null,
	byAudience: base.byAudience
};

type PartyOptions = Partial<
	Pick<typeof parties.$inferInsert, 'audience' | 'invitedToRegistry' | 'plusOnePolicy'>
>;

// A party and guest of its own per test, so suites never see each other's answers.
async function newGuest(options: PartyOptions = {}) {
	const [party] = await db
		.insert(parties)
		.values({ title: 'Тест', audience: 'family', invitedToRegistry: false, ...options })
		.returning({ id: parties.id });
	const [guest] = await db
		.insert(guests)
		.values({
			partyId: party!.id,
			firstName: 'Гость',
			lastName: 'Тестовый',
			displayName: 'Гость',
			nameKey: nameKey('Гость Тестовый'),
			botToken: randomUUID()
		})
		.returning({ id: guests.id });
	return guest!.id;
}

const payload = (overrides: Partial<RsvpPayload> = {}) =>
	rsvpPayloadSchema.parse({ attending: 'yes', ...overrides });

// A fixed moment before the deadline, so the suite does not start failing in November.
const open = new Date('2026-10-01T12:00:00+04:00');

const submit = (guestId: string, p: RsvpPayload) =>
	submitRsvp(db, guestId, p, { content, source: 'web', now: open });

const rowsOf = (guestId: string) => db.select().from(rsvps).where(eq(rsvps.guestId, guestId));

describe('submitRsvp', () => {
	it('creates the answer once and updates it on the next submission', async () => {
		const guestId = await newGuest();

		const first = await submit(guestId, payload({ mainCourses: ['plov'], drinks: ['tea'] }));
		expect(first).toMatchObject({ kind: 'saved', created: true });

		const second = await submit(guestId, payload({ attending: 'no', comment: 'Заболел' }));
		expect(second).toMatchObject({ kind: 'saved', created: false });
		if (first.kind !== 'saved' || second.kind !== 'saved') return;
		expect(Date.parse(second.updatedAt)).toBeGreaterThan(Date.parse(first.updatedAt));

		const rows = await rowsOf(guestId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			attending: 'no',
			mainCourses: [],
			drinks: [],
			comment: 'Заболел',
			source: 'web'
		});
		expect(rows[0]!.updatedAt.toISOString()).toBe(second.updatedAt);
	});

	it('rejects an unknown course id and writes nothing', async () => {
		const guestId = await newGuest();

		const result = await submit(guestId, payload({ mainCourses: ['lagman'] }));

		expect(result).toEqual({ kind: 'rejected', reason: 'unknownOption' });
		expect(await rowsOf(guestId)).toHaveLength(0);
	});

	it('keeps a rejected update from touching the saved answer', async () => {
		const guestId = await newGuest();
		await submit(guestId, payload({ drinks: ['juice'], telegramUsername: 'guest_one' }));

		const result = await submit(guestId, payload({ drinks: ['kvass'], telegramUsername: 'x' }));

		expect(result).toMatchObject({ kind: 'rejected' });
		const [row] = await rowsOf(guestId);
		expect(row?.drinks).toEqual(['juice']);
		const [guest] = await db.select().from(guests).where(eq(guests.id, guestId));
		expect(guest?.telegramUsername).toBe('guest_one');
	});

	it('stores the registry only for a party invited to it', async () => {
		const invited = await newGuest({ invitedToRegistry: true });
		const notInvited = await newGuest({ invitedToRegistry: false });

		await submit(invited, payload({ attendingRegistry: true }));
		await submit(notInvited, payload({ attendingRegistry: true }));

		expect((await rowsOf(invited))[0]?.attendingRegistry).toBe(true);
		expect((await rowsOf(notInvited))[0]?.attendingRegistry).toBe(false);
	});

	it('stores the transfer as off when the content offers none', async () => {
		const guestId = await newGuest();
		await submit(guestId, payload({ needsTransfer: true }));
		expect((await rowsOf(guestId))[0]?.needsTransfer).toBe(false);
	});

	it('writes the normalized Telegram username to the guest and clears it when emptied', async () => {
		const guestId = await newGuest();
		const username = async () =>
			(await db.select().from(guests).where(eq(guests.id, guestId)))[0]?.telegramUsername;

		await submit(guestId, payload({ telegramUsername: ' @alina_guest ' }));
		expect(await username()).toBe('alina_guest');

		await submit(guestId, payload({ telegramUsername: '' }));
		expect(await username()).toBeNull();
	});

	it('keeps one answer under concurrent submissions', async () => {
		const guestId = await newGuest();

		const results = await Promise.all([
			submit(guestId, payload({ drinks: ['tea'] })),
			submit(guestId, payload({ drinks: ['juice'] }))
		]);

		expect(results.map((r) => r.kind === 'saved' && r.created).sort()).toEqual([false, true]);
		expect(await rowsOf(guestId)).toHaveLength(1);
	});

	it('refuses an answer once the deadline day is over and keeps the saved one', async () => {
		const guestId = await newGuest();
		const closesAt = rsvpClosesAt(content.event);
		const before = new Date(closesAt.getTime() - 1);

		await expect(
			submitRsvp(db, guestId, payload({ drinks: ['tea'] }), { content, source: 'web', now: before })
		).resolves.toMatchObject({ kind: 'saved' });
		await expect(
			submitRsvp(db, guestId, payload({ attending: 'no' }), {
				content,
				source: 'web',
				now: closesAt
			})
		).resolves.toEqual({ kind: 'closed' });

		const [row] = await rowsOf(guestId);
		expect(row).toMatchObject({ attending: 'yes', drinks: ['tea'] });
	});

	it('reports a guest that no longer exists', async () => {
		await expect(submit(randomUUID(), payload())).resolves.toEqual({ kind: 'missing' });
	});
});

describe('submitRsvp: companion (tech.md §4 invariants 1 to 3)', () => {
	const olga = {
		firstName: 'Ольга',
		lastName: 'Смирнова',
		mainCourses: ['fish'],
		drinks: ['juice']
	};

	async function inviterWithParty() {
		const guestId = await newGuest({ plusOnePolicy: 'allowed' });
		const [row] = await db.select().from(guests).where(eq(guests.id, guestId));
		return { guestId, partyId: row!.partyId };
	}

	const companionsOf = (guestId: string) =>
		db.select().from(guests).where(eq(guests.invitedByGuestId, guestId));

	it('1: creates the companion as a plus one in the inviter party with its own answer', async () => {
		const { guestId, partyId } = await inviterWithParty();

		await submit(guestId, payload({ mainCourses: ['plov'], companion: olga }));

		const [companion, ...rest] = await companionsOf(guestId);
		expect(rest).toHaveLength(0);
		expect(companion).toMatchObject({
			partyId,
			isPlusOne: true,
			invitedByGuestId: guestId,
			firstName: 'Ольга',
			lastName: 'Смирнова',
			displayName: 'Ольга',
			nameKey: nameKey('Ольга Смирнова'),
			telegramChatId: null
		});
		expect(companion!.botToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

		// The companion's own row is what menu counters add up.
		const [answer] = await rowsOf(companion!.id);
		expect(answer).toMatchObject({
			attending: 'yes',
			mainCourses: ['fish'],
			drinks: ['juice'],
			attendingRegistry: false,
			source: 'web'
		});
		const coming = await db
			.select({ mainCourses: rsvps.mainCourses })
			.from(rsvps)
			.where(inArray(rsvps.guestId, [guestId, companion!.id]));
		expect(coming.flatMap((r) => r.mainCourses).sort()).toEqual(['fish', 'plov']);
	});

	it('2: resubmitting updates the one companion instead of adding another', async () => {
		const { guestId } = await inviterWithParty();

		await submit(guestId, payload({ companion: olga }));
		const [first] = await companionsOf(guestId);
		await submit(guestId, payload({ companion: olga }));
		await submit(
			guestId,
			payload({ companion: { firstName: 'Оля', lastName: '', mainCourses: [], drinks: ['tea'] } })
		);

		const companions = await companionsOf(guestId);
		expect(companions).toHaveLength(1);
		expect(companions[0]).toMatchObject({ id: first!.id, firstName: 'Оля', nameKey: 'оля' });
		expect(companions[0]!.botToken).toBe(first!.botToken);
		expect(await rowsOf(first!.id)).toHaveLength(1);
		expect(await findCompanion(db, guestId)).toEqual({
			firstName: 'Оля',
			lastName: '',
			mainCourses: [],
			drinks: ['tea']
		});
	});

	it('2: concurrent submissions with a companion still leave exactly one', async () => {
		const { guestId } = await inviterWithParty();

		await Promise.all(
			Array.from({ length: 4 }, () => submit(guestId, payload({ companion: olga })))
		);

		expect(await companionsOf(guestId)).toHaveLength(1);
	});

	it('3: answering no removes the companion and its answer', async () => {
		const { guestId } = await inviterWithParty();
		await submit(guestId, payload({ companion: olga }));
		const [companion] = await companionsOf(guestId);

		await expect(submit(guestId, payload({ attending: 'no' }))).resolves.toMatchObject({
			kind: 'saved'
		});

		expect(await companionsOf(guestId)).toHaveLength(0);
		expect(await rowsOf(companion!.id)).toHaveLength(0);
		expect(await findCompanion(db, guestId)).toBeNull();
	});

	it('removes the companion when a guest who still comes drops them', async () => {
		const { guestId } = await inviterWithParty();
		await submit(guestId, payload({ companion: olga }));

		await submit(guestId, payload({ companion: null }));

		expect(await companionsOf(guestId)).toHaveLength(0);
	});

	it('rejects a companion with no and keeps the existing one untouched', async () => {
		const { guestId } = await inviterWithParty();
		await submit(guestId, payload({ companion: olga }));

		const result = await submit(guestId, payload({ attending: 'no', companion: olga }));

		expect(result).toEqual({ kind: 'rejected', reason: 'companionNotAttending' });
		expect(await companionsOf(guestId)).toHaveLength(1);
	});

	it('rejects a companion when the party allows none and creates no row', async () => {
		const guestId = await newGuest({ plusOnePolicy: 'none' });

		const result = await submit(guestId, payload({ companion: olga }));

		expect(result).toEqual({ kind: 'rejected', reason: 'companionNotAllowed' });
		expect(await companionsOf(guestId)).toHaveLength(0);
	});

	it('rejects an unknown dish of the companion and rolls the whole answer back', async () => {
		const { guestId } = await inviterWithParty();

		const result = await submit(
			guestId,
			payload({ companion: { ...olga, mainCourses: ['lagman'] } })
		);

		expect(result).toEqual({ kind: 'rejected', reason: 'unknownOption' });
		expect(await rowsOf(guestId)).toHaveLength(0);
		expect(await companionsOf(guestId)).toHaveLength(0);
	});
});
