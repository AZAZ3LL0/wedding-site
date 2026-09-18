import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '$lib/server/db';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { submitRsvp } from '$lib/server/rsvp/service';
import type { RsvpPayload } from '$lib/types';
import { seed, seedGuests } from '../../../../scripts/seed';
import { deleteGuest, listGuestRows, updateParty } from './repo';

const { db, close } = createDb(inject('databaseUrl'));
beforeAll(() => seed(db));
afterAll(() => close());

const byName = (firstName: string, lastName: string) =>
	seedGuests.find((g) => g.firstName === firstName && g.lastName === lastName)!;

const content = {
	registry: { title: 'ЗАГС' },
	byAudience: {
		family: { showRegistry: true },
		friends: { showRegistry: true },
		colleagues: { showRegistry: true }
	},
	menu: { multiSelect: true, courses: [{ id: 'beef' }, { id: 'fish' }], drinks: [{ id: 'wine' }] },
	transfer: { route: 'Автобус', time: '16:00' },
	event: { date: '2026-11-28', rsvpDeadline: '2026-11-14', utcOffset: '+04:00' }
} as unknown as Parameters<typeof submitRsvp>[3]['content'];

const answer = (over: Partial<RsvpPayload> = {}): RsvpPayload => ({
	attending: 'yes',
	attendingRegistry: false,
	mainCourses: [],
	drinks: [],
	allergies: null,
	needsTransfer: false,
	songRequest: null,
	comment: null,
	telegramUsername: null,
	companion: null,
	...over
});

// Seed rows are shared with the other database suites, so every mutating case builds its own party.
async function makeGuest(party: Partial<typeof parties.$inferInsert> = {}) {
	const [created] = await db
		.insert(parties)
		.values({ title: 'Тест', audience: 'friends', plusOnePolicy: 'allowed', ...party })
		.returning({ id: parties.id });
	const suffix = randomUUID().slice(0, 8);
	const [guest] = await db
		.insert(guests)
		.values({
			partyId: created!.id,
			firstName: 'Тест',
			lastName: suffix,
			displayName: 'Тест',
			nameKey: nameKey(`Тест ${suffix}`),
			botToken: randomBytes(32).toString('base64url')
		})
		.returning({ id: guests.id });
	return { partyId: created!.id, guestId: guest!.id };
}

const find = async (guestId: string) =>
	(await listGuestRows(db)).find((row) => row.id === guestId)!;

describe('listGuestRows', () => {
	it('never returns a bot token or a chat id', async () => {
		const rows = await listGuestRows(db);
		const serialized = JSON.stringify(rows);

		expect(rows.length).toBeGreaterThan(0);
		expect(serialized).not.toContain('seed-token');
		expect(serialized).not.toContain('100000001');
		expect(Object.keys(rows[0]!).sort()).toEqual(
			[
				'id',
				'firstName',
				'lastName',
				'name',
				'isPlusOne',
				'invitedByName',
				'companionName',
				'partyId',
				'partyTitle',
				'audience',
				'plusOnePolicy',
				'rsvp'
			].sort()
		);
	});

	it('links a companion to the guest who brought them', async () => {
		const petrov = await find(byName('Алексей', 'Петров').id);
		const olga = await find(byName('Ольга', 'Смирнова').id);

		expect(petrov.companionName).toBe('Ольга Смирнова');
		expect(petrov.invitedByName).toBeNull();
		expect(olga.isPlusOne).toBe(true);
		expect(olga.invitedByName).toBe('Алексей Петров');
	});

	it('leaves rsvp null for a guest who has not replied', async () => {
		expect((await find(byName('Мария', 'Иванова').id)).rsvp).toBeNull();
	});

	it('carries the answer of a guest who replied', async () => {
		const { guestId } = await makeGuest();
		await submitRsvp(db, guestId, answer({}), { content, source: 'web' });

		const row = await find(guestId);
		expect(row.rsvp).toMatchObject({ attending: 'yes' });
		expect(Date.parse(row.rsvp!.updatedAt)).not.toBeNaN();
	});
});

describe('updateParty', () => {
	it('moves the whole party to another group', async () => {
		const { partyId, guestId } = await makeGuest({ audience: 'friends' });

		await expect(
			updateParty(db, partyId, { audience: 'colleagues', plusOnePolicy: 'none' })
		).resolves.toBe(true);

		expect(await find(guestId)).toMatchObject({
			audience: 'colleagues',
			plusOnePolicy: 'none'
		});
	});

	it('reports a party that is not there', async () => {
		await expect(
			updateParty(db, randomUUID(), { audience: 'family', plusOnePolicy: 'none' })
		).resolves.toBe(false);
	});
});

describe('deleteGuest', () => {
	it('removes the guest with the companion, the answers and the emptied party', async () => {
		const { partyId, guestId } = await makeGuest();
		await submitRsvp(
			db,
			guestId,
			answer({
				companion: { firstName: 'Пара', lastName: 'Тестова', mainCourses: [], drinks: [] }
			}),
			{ content, source: 'web' }
		);

		await expect(deleteGuest(db, guestId)).resolves.toBe(true);

		expect(await db.select().from(guests).where(eq(guests.partyId, partyId))).toEqual([]);
		expect(await db.select().from(parties).where(eq(parties.id, partyId))).toEqual([]);
		expect(await db.select().from(rsvps).where(eq(rsvps.guestId, guestId))).toEqual([]);
	});

	it('keeps the party while other guests remain in it', async () => {
		const { partyId, guestId } = await makeGuest();
		await db.insert(guests).values({
			partyId,
			firstName: 'Сосед',
			lastName: 'Тестов',
			displayName: 'Сосед',
			nameKey: nameKey('Сосед Тестов'),
			botToken: randomBytes(32).toString('base64url')
		});

		await expect(deleteGuest(db, guestId)).resolves.toBe(true);

		expect(await db.select().from(guests).where(eq(guests.id, guestId))).toEqual([]);
		expect(await db.select().from(parties).where(eq(parties.id, partyId))).toHaveLength(1);
	});

	it('reports a guest that is not there', async () => {
		await expect(deleteGuest(db, randomUUID())).resolves.toBe(false);
	});
});
