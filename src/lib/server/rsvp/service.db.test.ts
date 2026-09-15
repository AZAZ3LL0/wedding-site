import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { parseContent } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import { createDb } from '$lib/server/db';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { rsvpPayloadSchema, type RsvpPayload } from '$lib/types';
import { submitRsvp, type RulesContent } from './service';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

const base = parseContent(raw);

const content: RulesContent = {
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

type PartyOptions = Partial<Pick<typeof parties.$inferInsert, 'audience' | 'invitedToRegistry'>>;

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

const submit = (guestId: string, p: RsvpPayload) =>
	submitRsvp(db, guestId, p, { content, source: 'web' });

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

	it('reports a guest that no longer exists', async () => {
		await expect(submit(randomUUID(), payload())).resolves.toEqual({ kind: 'missing' });
	});
});
