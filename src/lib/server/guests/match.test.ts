import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Audience } from '$lib/types';
import { seedGuests, seedParties } from '../../../../scripts/seed';
import { levenshtein, match, type GroupLabels, type MatchCandidate } from './match';
import { nameKey } from './name-key';

const groupLabels: GroupLabels = { family: 'родные', friends: 'друзья', colleagues: 'коллеги' };

const audienceOf = new Map(seedParties.map((p) => [p.id, p.audience]));
const seed: MatchCandidate[] = seedGuests.map((g) => ({
	guestId: g.id,
	nameKey: g.nameKey,
	lastName: g.lastName,
	audience: audienceOf.get(g.partyId)!,
	invitedByGuestId: g.invitedByGuestId ?? null
}));

const seedId = (firstName: string, lastName: string, audience?: Audience) =>
	seedGuests.find(
		(g) =>
			g.firstName === firstName &&
			g.lastName === lastName &&
			(!audience || audienceOf.get(g.partyId) === audience)
	)!.id;

describe('match on seed data', () => {
	it('opens the one invitation for an exact name in any order and case', () => {
		const ivan = seedId('Иван', 'Иванов');
		expect(match('Иван Иванов', seed, groupLabels)).toEqual({ kind: 'single', guestId: ivan });
		expect(match('  ИВАНОВ   иван ', seed, groupLabels)).toEqual({
			kind: 'single',
			guestId: ivan
		});
	});

	it('forgives up to two typos per token', () => {
		expect(match('Дмитри Казлов', seed, groupLabels)).toEqual({
			kind: 'single',
			guestId: seedId('Дмитрий', 'Козлов')
		});
	});

	it('does not stretch a close name onto a relative with an exact match', () => {
		expect(match('Мария Иванова', seed, groupLabels)).toEqual({
			kind: 'single',
			guestId: seedId('Мария', 'Иванова')
		});
	});

	it('opens the inviter card for a companion name', () => {
		expect(match('Ольга Смирнова', seed, groupLabels)).toEqual({
			kind: 'single',
			guestId: seedId('Алексей', 'Петров')
		});
	});

	it('lets namesakes choose by group instead of opening one of them', () => {
		expect(match('Анна Сидорова', seed, groupLabels)).toEqual({
			kind: 'ambiguous',
			candidates: expect.arrayContaining([
				{ guestId: seedId('Анна', 'Сидорова', 'colleagues'), hint: 'коллеги' },
				{ guestId: seedId('Анна', 'Сидорова', 'family'), hint: 'родные' }
			])
		});
		const result = match('Анна Сидорова', seed, groupLabels);
		expect(result.kind === 'ambiguous' && result.candidates).toHaveLength(2);
	});

	it('finds nobody for a stranger, a lone first name or an empty input', () => {
		for (const name of ['Пётр Первый', 'Анна', '', '  123 !! ']) {
			expect(match(name, seed, groupLabels)).toEqual({ kind: 'none' });
		}
	});
});

// Candidate names use Cyrillic only, so a Latin token of three letters is at least three edits
// away from any of their tokens.
const cyrillic = fc.constantFrom(...'абвгдежзиклмнопрстуфхцчшэюя');
const latin = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz');
const token = (unit: fc.Arbitrary<string>, minLength = 2) =>
	fc.string({ unit, minLength, maxLength: 9 });
const audience = fc.constantFrom<Audience>('family', 'friends', 'colleagues');

const person = fc.record({
	tokens: fc.array(token(cyrillic), { minLength: 1, maxLength: 3 }),
	audience,
	companion: fc.boolean()
});

// A guest list where companions always point at a main guest, as the database guarantees.
const guestList = fc.array(person, { minLength: 1, maxLength: 8 }).map((people) => {
	const list: MatchCandidate[] = [];
	people.forEach((p, index) => {
		const inviter = list.find((c) => c.invitedByGuestId === null);
		list.push({
			guestId: `g${index}`,
			nameKey: nameKey(p.tokens.join(' ')),
			lastName: p.tokens.at(-1)!,
			audience: p.audience,
			invitedByGuestId: p.companion && inviter ? inviter.guestId : null
		});
	});
	return list;
});

const mainIds = (list: MatchCandidate[]) =>
	new Set(list.filter((c) => c.invitedByGuestId === null).map((c) => c.guestId));

const ids = (result: ReturnType<typeof match>) =>
	result.kind === 'single'
		? [result.guestId]
		: result.kind === 'ambiguous'
			? result.candidates.map((c) => c.guestId)
			: [];

describe('match properties', () => {
	it('prefers an exact name over names within a typo of it', () => {
		fc.assert(
			fc.property(guestList, token(cyrillic), audience, (list, extra, group) => {
				const guest = list.find((c) => c.invitedByGuestId === null)!;
				const unique = list.filter((c) => c.nameKey === guest.nameKey).length === 1;
				fc.pre(unique);
				const close: MatchCandidate = {
					guestId: 'close',
					nameKey: nameKey(`${guest.nameKey}${extra[0]}`),
					lastName: guest.lastName,
					audience: group,
					invitedByGuestId: null
				};
				expect(match(guest.nameKey, [...list, close], groupLabels)).toEqual(
					match(guest.nameKey, list, groupLabels)
				);
			})
		);
	});

	it('only ever opens a main guest card, never a companion', () => {
		fc.assert(
			fc.property(guestList, fc.nat(), (list, pick) => {
				const typed = list[pick % list.length]!.nameKey;
				const mains = mainIds(list);
				for (const id of ids(match(typed, list, groupLabels))) expect(mains.has(id)).toBe(true);
			})
		);
	});

	it('always finds the card of an exactly typed name', () => {
		fc.assert(
			fc.property(guestList, fc.nat(), (list, pick) => {
				const guest = list[pick % list.length]!;
				const owner = guest.invitedByGuestId ?? guest.guestId;
				expect(ids(match(guest.nameKey, list, groupLabels))).toContain(owner);
			})
		);
	});

	it('does not depend on token order, case or spacing of the typed name', () => {
		fc.assert(
			fc.property(
				guestList,
				fc.array(token(cyrillic), { minLength: 1, maxLength: 3 }),
				fc.boolean(),
				(list, typed, shout) => {
					const messy = [...typed]
						.reverse()
						.map((t) => (shout ? t.toUpperCase() : t))
						.join('  \t ');
					expect(match(messy, list, groupLabels)).toEqual(
						match(typed.join(' '), list, groupLabels)
					);
				}
			)
		);
	});

	it('finds nobody when a typed token is more than two edits from every name', () => {
		fc.assert(
			fc.property(
				guestList,
				fc.array(token(cyrillic), { maxLength: 2 }),
				token(latin, 3),
				(list, rest, far) => {
					expect(match([...rest, far].join(' '), list, groupLabels)).toEqual({ kind: 'none' });
				}
			)
		);
	});

	it('ignores guests whose names are far from the typed one', () => {
		fc.assert(
			fc.property(
				guestList,
				fc.array(token(latin, 3), { minLength: 1, maxLength: 3 }),
				fc.nat(),
				(list, stranger, pick) => {
					const typed = list[pick % list.length]!.nameKey;
					const extended = [
						...list,
						{
							guestId: 'stranger',
							nameKey: nameKey(stranger.join(' ')),
							lastName: stranger[0]!,
							audience: 'friends' as const,
							invitedByGuestId: null
						}
					];
					expect(match(typed, extended, groupLabels)).toEqual(match(typed, list, groupLabels));
				}
			)
		);
	});

	it('gives namesakes from different groups distinct hints', () => {
		fc.assert(
			fc.property(
				fc.array(token(cyrillic), { minLength: 1, maxLength: 3 }),
				fc.uniqueArray(audience, { minLength: 2, maxLength: 3 }),
				(tokens, audiences) => {
					const key = nameKey(tokens.join(' '));
					const list = audiences.map((a, i) => ({
						guestId: `n${i}`,
						nameKey: key,
						lastName: tokens.at(-1)!,
						audience: a,
						invitedByGuestId: null
					}));
					const result = match(key, list, groupLabels);
					expect(result.kind).toBe('ambiguous');
					if (result.kind !== 'ambiguous') return;
					expect(result.candidates.map((c) => c.guestId).sort()).toEqual(
						list.map((c) => c.guestId).sort()
					);
					expect(new Set(result.candidates.map((c) => c.hint)).size).toBe(audiences.length);
				}
			)
		);
	});
});

describe('levenshtein', () => {
	const word = fc.string({ unit: 'grapheme', maxLength: 10 });

	it('is a metric', () => {
		fc.assert(
			fc.property(word, word, word, (a, b, c) => {
				expect(levenshtein(a, a)).toBe(0);
				expect(levenshtein(a, b)).toBe(levenshtein(b, a));
				expect(levenshtein(a, c)).toBeLessThanOrEqual(levenshtein(a, b) + levenshtein(b, c));
			})
		);
	});

	it('counts a single insertion, deletion or substitution as one edit', () => {
		fc.assert(
			fc.property(token(cyrillic, 1), fc.nat(), cyrillic, (w, at, letter) => {
				const i = at % w.length;
				const inserted = w.slice(0, i) + letter + w.slice(i);
				const deleted = w.slice(0, i) + w.slice(i + 1);
				const replaced = w.slice(0, i) + letter + w.slice(i + 1);
				expect(levenshtein(w, inserted)).toBe(1);
				expect(levenshtein(w, deleted)).toBe(1);
				expect(levenshtein(w, replaced)).toBeLessThanOrEqual(1);
			})
		);
	});
});
