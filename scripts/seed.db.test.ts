import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '../src/lib/server/db';
import { guests, parties } from '../src/lib/server/db/schema';
import { nameKey } from '../src/lib/server/guests/name-key';
import { seed } from './seed';

const { db, close } = createDb(inject('databaseUrl'));

async function snapshot() {
	const allParties = await db.select().from(parties);
	const allGuests = await db.select().from(guests);
	return { allParties, allGuests };
}

beforeAll(() => seed(db));
afterAll(() => close());

describe('seed covers every case from tech.md §10', () => {
	it('has parties of all three audiences', async () => {
		const { allParties } = await snapshot();
		expect(new Set(allParties.map((p) => p.audience))).toEqual(
			new Set(['family', 'friends', 'colleagues'])
		);
	});

	it('has a couple in one party', async () => {
		const { allGuests } = await snapshot();
		const mainGuestsPerParty = Map.groupBy(
			allGuests.filter((g) => !g.isPlusOne),
			(g) => g.partyId
		);
		expect([...mainGuestsPerParty.values()].some((members) => members.length >= 2)).toBe(true);
	});

	it('has a guest whose party allows a plus one', async () => {
		const { allParties, allGuests } = await snapshot();
		const allowed = new Set(
			allParties.filter((p) => p.plusOnePolicy === 'allowed').map((p) => p.id)
		);
		expect(allGuests.some((g) => !g.isPlusOne && allowed.has(g.partyId))).toBe(true);
	});

	it('has namesakes in different parties to exercise ambiguous matching', async () => {
		const { allGuests } = await snapshot();
		const byKey = Map.groupBy(
			allGuests.filter((g) => !g.isPlusOne),
			(g) => g.nameKey
		);
		const namesakes = [...byKey.values()].find(
			(group) => new Set(group.map((g) => g.partyId)).size >= 2
		);
		expect(namesakes).toBeDefined();
	});

	it('has a guest linked to Telegram', async () => {
		const { allGuests } = await snapshot();
		expect(allGuests.some((g) => !g.isPlusOne && g.telegramChatId !== null)).toBe(true);
	});

	it('has a companion, so the invariants below are not vacuous', async () => {
		const { allGuests } = await snapshot();
		expect(allGuests.some((g) => g.isPlusOne)).toBe(true);
	});

	it('stores the normalized key of every name', async () => {
		const { allGuests } = await snapshot();
		for (const g of allGuests) {
			expect(g.nameKey).toBe(nameKey(`${g.firstName} ${g.lastName}`));
		}
	});
});

describe('guest invariants from tech.md §4', () => {
	it('1: a companion is a plus one in the inviter party, and only companions have an inviter', async () => {
		const { allGuests } = await snapshot();
		const byId = new Map(allGuests.map((g) => [g.id, g]));

		for (const g of allGuests) {
			expect(g.isPlusOne).toBe(g.invitedByGuestId !== null);
			if (g.invitedByGuestId === null) continue;

			const inviter = byId.get(g.invitedByGuestId);
			expect(inviter).toBeDefined();
			expect(inviter?.partyId).toBe(g.partyId);
			expect(inviter?.isPlusOne).toBe(false);
		}
	});

	it('2: a guest has at most one companion, and reseeding does not add another', async () => {
		const before = await snapshot();
		await seed(db);
		const after = await snapshot();

		expect(after.allGuests).toHaveLength(before.allGuests.length);
		expect(after.allParties).toHaveLength(before.allParties.length);

		const companionsPerInviter = Map.groupBy(
			after.allGuests.filter((g) => g.invitedByGuestId !== null),
			(g) => g.invitedByGuestId
		);
		for (const companions of companionsPerInviter.values()) {
			expect(companions).toHaveLength(1);
		}
	});
});
