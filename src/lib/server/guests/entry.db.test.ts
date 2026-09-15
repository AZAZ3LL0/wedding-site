import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '$lib/server/db';
import { guests, parties } from '$lib/server/db/schema';
import { seed, seedGuests } from '../../../../scripts/seed';
import { chooseCard, enter, newRegistration, register, type EntryName } from './entry';
import { nameKey } from './name-key';
import { insertPartyWithGuest } from './repo';

const { db, close } = createDb(inject('databaseUrl'));
beforeAll(() => seed(db));
afterAll(() => close());

const labels = { family: 'родные', friends: 'друзья', colleagues: 'коллеги' };

// Letters only: nameKey drops digits, and a unique surname keeps runs from matching each other.
function uniqueName(firstName = 'Гость'): EntryName {
	const letters = 'абвгдежзиклмнопрстуфхцчшэюя';
	const suffix = Array.from(
		randomUUID().replace(/-/g, '').slice(0, 10),
		(c) => letters[parseInt(c, 16)]
	).join('');
	return { firstName, lastName: `Новиков${suffix}` };
}

const guestRows = (id: string) => db.select().from(guests).where(eq(guests.id, id));
const partyCount = async () => (await db.select({ id: parties.id }).from(parties)).length;

describe('newRegistration', () => {
	it('gives every registration the defaults from tech.md §6', () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1, maxLength: 60 }),
				fc.string({ minLength: 1, maxLength: 60 }),
				(firstName, lastName) => {
					const { party, guest } = newRegistration({ firstName, lastName }, 'token');
					expect(party).toEqual({
						title: `${firstName} ${lastName}`,
						audience: 'friends',
						plusOnePolicy: 'allowed',
						invitedToRegistry: false,
						note: null
					});
					expect(guest).toEqual({
						firstName,
						lastName,
						displayName: firstName,
						nameKey: nameKey(`${firstName} ${lastName}`),
						isPlusOne: false,
						botToken: 'token'
					});
				}
			)
		);
	});
});

describe('enter', () => {
	it('registers a new name as a guest in a party of their own', async () => {
		const name = uniqueName('Василиса');

		const result = await enter(db, name, labels);

		expect(result.kind).toBe('registered');
		if (result.kind !== 'registered') return;
		const [guest] = await guestRows(result.guestId);
		expect(guest).toMatchObject({
			firstName: 'Василиса',
			lastName: name.lastName,
			displayName: 'Василиса',
			nameKey: nameKey(`Василиса ${name.lastName}`),
			isPlusOne: false,
			invitedByGuestId: null,
			telegramChatId: null
		});
		expect(guest!.botToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
		const [party] = await db.select().from(parties).where(eq(parties.id, guest!.partyId));
		expect(party).toMatchObject({
			title: `Василиса ${name.lastName}`,
			audience: 'friends',
			plusOnePolicy: 'allowed',
			invitedToRegistry: false,
			note: null
		});
	});

	it('offers the existing card instead of a duplicate when the same name comes back', async () => {
		const name = uniqueName();
		const first = await enter(db, name, labels);
		if (first.kind !== 'registered') throw new Error('expected a registration');
		const before = await partyCount();

		// Case, spacing and a typo still find the card.
		const again = await enter(
			db,
			{ firstName: ` ${name.firstName.toUpperCase()}`, lastName: `${name.lastName.slice(0, -1)}ы` },
			labels
		);

		expect(again).toEqual({ kind: 'known', cards: [{ guestId: first.guestId, hint: null }] });
		expect(await partyCount()).toBe(before);
	});

	it('shows namesakes with hints to tell them apart', async () => {
		const result = await enter(db, { firstName: 'Анна', lastName: 'Сидорова' }, labels);

		expect(result.kind).toBe('known');
		if (result.kind !== 'known') return;
		const annas = seedGuests.filter((g) => g.firstName === 'Анна').map((g) => g.id);
		expect(result.cards.map((c) => c.guestId).sort()).toEqual(annas.sort());
		expect(result.cards.every((c) => c.hint !== null)).toBe(true);
	});

	it('leads a companion name to the inviter card (invariant 5)', async () => {
		// Other suites add companions named like the seed one, so this pair gets names of its own.
		const inviter = await enter(db, uniqueName('Марат'), labels);
		if (inviter.kind !== 'registered') throw new Error('expected a registration');
		const [row] = await guestRows(inviter.guestId);
		const companion = uniqueName('Лейла');
		await db.insert(guests).values({
			...newRegistration(companion, randomUUID()).guest,
			partyId: row!.partyId,
			isPlusOne: true,
			invitedByGuestId: inviter.guestId
		});

		await expect(enter(db, companion, labels)).resolves.toEqual({
			kind: 'known',
			cards: [{ guestId: inviter.guestId, hint: null }]
		});
	});
});

describe('chooseCard', () => {
	it('accepts a card the name matches', async () => {
		const annas = seedGuests.filter((g) => g.firstName === 'Анна');
		const name = { firstName: 'Анна', lastName: 'Сидорова' };
		for (const anna of annas) {
			await expect(chooseCard(db, name, anna.id, labels)).resolves.toEqual({ allowed: true });
		}
	});

	it('refuses a card outside the matches and hands the real choice back', async () => {
		const ivan = seedGuests.find((g) => g.firstName === 'Иван')!;
		const result = await chooseCard(
			db,
			{ firstName: 'Анна', lastName: 'Сидорова' },
			ivan.id,
			labels
		);

		expect(result.allowed).toBe(false);
		if (result.allowed) return;
		expect(result.cards.map((c) => c.guestId)).not.toContain(ivan.id);
		expect(result.cards).toHaveLength(2);
	});

	it('refuses any card for a name nobody has', async () => {
		const ivan = seedGuests.find((g) => g.firstName === 'Иван')!;
		await expect(chooseCard(db, uniqueName(), ivan.id, labels)).resolves.toEqual({
			allowed: false,
			cards: []
		});
	});
});

describe('register', () => {
	it('creates a second guest for a namesake who says it is not them', async () => {
		const name = uniqueName();
		const first = await register(db, name);
		const second = await register(db, name);

		expect(second).not.toBe(first);
		const [a] = await guestRows(first);
		const [b] = await guestRows(second);
		expect(a!.partyId).not.toBe(b!.partyId);
		expect(a!.botToken).not.toBe(b!.botToken);
	});

	it('rolls the party back when the guest cannot be written', async () => {
		const name = uniqueName();
		const takenToken = seedGuests[0]!.botToken;
		const before = await partyCount();

		const { party, guest } = newRegistration(name, takenToken);
		await expect(insertPartyWithGuest(db, party, guest)).rejects.toThrow();

		expect(await partyCount()).toBe(before);
	});
});
