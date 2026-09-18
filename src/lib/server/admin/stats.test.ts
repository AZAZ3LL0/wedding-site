import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AdminGuestRow, AdminRsvp } from './repo';
import { aggregate } from './stats';

const answer = fc
	.record({
		attending: fc.constantFrom('yes' as const, 'no' as const),
		updatedAt: fc.constant('2026-06-01T10:00:00.000Z')
	})
	.map((rsvp): AdminRsvp => rsvp);

let nextId = 0;

const row = fc
	.record({
		isPlusOne: fc.boolean(),
		rsvp: fc.option(answer, { nil: null })
	})
	.map(({ isPlusOne, rsvp }): AdminGuestRow => ({
		id: `guest-${++nextId}`,
		firstName: 'Гость',
		lastName: `${nextId}`,
		name: `Гость ${nextId}`,
		isPlusOne,
		invitedByName: null,
		companionName: null,
		partyId: `party-${nextId}`,
		partyTitle: 'Приглашение',
		audience: 'friends',
		plusOnePolicy: 'none',
		rsvp
	}));

const rows = fc.array(row, { maxLength: 30 });

describe('aggregate', () => {
	it('splits every guest into exactly one of the three states', () => {
		fc.assert(
			fc.property(rows, (list) => {
				const stats = aggregate(list);
				expect(stats.total).toBe(list.length);
				expect(stats.attending + stats.declined + stats.noAnswer).toBe(stats.total);
			})
		);
	});

	it('counts a companion like any other guest', () => {
		fc.assert(
			fc.property(rows, (list) => {
				const before = aggregate(list);
				const companion: AdminGuestRow = {
					id: 'companion',
					firstName: 'Ольга',
					lastName: 'Спутница',
					name: 'Ольга Спутница',
					isPlusOne: true,
					invitedByName: 'Иван Иванов',
					companionName: null,
					partyId: 'party-1',
					partyTitle: 'Приглашение',
					audience: 'friends',
					plusOnePolicy: 'allowed',
					rsvp: { attending: 'yes', updatedAt: '2026-06-01T10:00:00.000Z' }
				};
				const after = aggregate([...list, companion]);
				expect(after.total).toBe(before.total + 1);
				expect(after.attending).toBe(before.attending + 1);
			})
		);
	});

	it('counts the example list', () => {
		const list = [
			{ attending: 'yes' as const },
			{ attending: 'yes' as const },
			{ attending: 'no' as const },
			null
		].map((rsvp, index): AdminGuestRow => ({
			id: `g${index}`,
			firstName: 'Гость',
			lastName: `${index}`,
			name: `Гость ${index}`,
			isPlusOne: false,
			invitedByName: null,
			companionName: null,
			partyId: `p${index}`,
			partyTitle: 'Приглашение',
			audience: 'friends',
			plusOnePolicy: 'none',
			rsvp: rsvp ? { ...rsvp, updatedAt: '2026-06-01T10:00:00.000Z' } : null
		}));

		expect(aggregate(list)).toEqual({ total: 4, attending: 2, declined: 1, noAnswer: 1 });
	});
});
