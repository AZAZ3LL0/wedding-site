import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AdminGuestRow, AdminRsvp } from './repo';
import { aggregate } from './stats';

const menu = {
	courses: [
		{ id: 'beef', label: 'Говядина' },
		{ id: 'fish', label: 'Рыба' }
	],
	drinks: [
		{ id: 'wine', label: 'Вино' },
		{ id: 'juice', label: 'Сок' }
	]
};

const courseIds = menu.courses.map((c) => c.id);
const drinkIds = menu.drinks.map((d) => d.id);

const picks = (ids: string[]) => fc.uniqueArray(fc.constantFrom(...ids), { maxLength: ids.length });

const answer = fc
	.record({
		attending: fc.constantFrom('yes' as const, 'no' as const),
		attendingRegistry: fc.boolean(),
		mainCourses: picks(courseIds),
		drinks: picks(drinkIds),
		allergies: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
		needsTransfer: fc.boolean(),
		comment: fc.constant(null),
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
		id: `guest-${nextId++}`,
		firstName: 'Гость',
		lastName: String(nextId),
		name: `Гость ${nextId}`,
		isPlusOne,
		invitedByName: isPlusOne ? 'Кто-то' : null,
		companionName: null,
		partyId: 'party',
		partyTitle: 'Приглашение',
		audience: 'friends',
		plusOnePolicy: 'allowed',
		invitedToRegistry: true,
		telegramUsername: null,
		telegramLinked: false,
		rsvp
	}));

const rows = fc.array(row, { maxLength: 30 });

// A declined answer carries no menu, registry or transfer (tech.md §6), so tests build one that way.
const declined = (): AdminRsvp => ({
	attending: 'no',
	attendingRegistry: false,
	mainCourses: [],
	drinks: [],
	allergies: null,
	needsTransfer: false,
	comment: null,
	updatedAt: '2026-06-01T10:00:00.000Z'
});

describe('aggregate', () => {
	it('splits every guest into exactly one status bucket', () => {
		fc.assert(
			fc.property(rows, (list) => {
				const stats = aggregate(list, menu);
				expect(stats.total).toBe(list.length);
				expect(stats.attending + stats.declined + stats.noAnswer).toBe(stats.total);
			})
		);
	});

	it('never counts an option more often than there are attending guests', () => {
		fc.assert(
			fc.property(rows, (list) => {
				const stats = aggregate(list, menu);
				for (const { count } of [...stats.courses, ...stats.drinks]) {
					expect(count).toBeGreaterThanOrEqual(0);
					expect(count).toBeLessThanOrEqual(stats.attending);
				}
			})
		);
	});

	it('keeps the menu order and lists every option, chosen or not', () => {
		fc.assert(
			fc.property(rows, (list) => {
				const stats = aggregate(list, menu);
				expect(stats.courses.map((c) => c.id)).toEqual(courseIds);
				expect(stats.drinks.map((d) => d.id)).toEqual(drinkIds);
			})
		);
	});

	it('counts a companion like any other attending guest', () => {
		fc.assert(
			fc.property(rows, answer, (list, rsvp) => {
				const before = aggregate(list, menu);
				const companion = { ...list[0], id: 'companion', isPlusOne: true, rsvp };
				const after = aggregate([...list, companion as AdminGuestRow], menu);

				const coming = rsvp.attending === 'yes';
				expect(after.attending).toBe(before.attending + (coming ? 1 : 0));
				expect(after.declined).toBe(before.declined + (coming ? 0 : 1));
				for (const course of after.courses) {
					const was = before.courses.find((c) => c.id === course.id)!.count;
					expect(course.count).toBe(was + (coming && rsvp.mainCourses.includes(course.id) ? 1 : 0));
				}
			})
		);
	});

	it('ignores menu ids that are no longer on the menu', () => {
		const stats = aggregate(
			[{ ...sample(), rsvp: { ...declined(), attending: 'yes', mainCourses: ['gone'] } }],
			menu
		);
		expect(stats.attending).toBe(1);
		expect(stats.courses.every((c) => c.count === 0)).toBe(true);
	});

	it('lists allergies of attending guests by name', () => {
		const stats = aggregate(
			[
				{
					...sample(),
					firstName: 'Анна',
					lastName: 'Сидорова',
					name: 'Анна Сидорова',
					rsvp: { ...declined(), attending: 'yes', allergies: 'без орехов' }
				},
				{ ...sample(), rsvp: { ...declined(), allergies: 'не считается' } },
				{ ...sample(), rsvp: null }
			],
			menu
		);
		expect(stats.allergies).toEqual([{ name: 'Анна Сидорова', text: 'без орехов' }]);
	});

	it('counts registry and transfer only among attending guests', () => {
		const stats = aggregate(
			[
				{
					...sample(),
					rsvp: { ...declined(), attending: 'yes', attendingRegistry: true, needsTransfer: true }
				},
				{ ...sample(), rsvp: { ...declined(), attending: 'yes' } }
			],
			menu
		);
		expect(stats).toMatchObject({ attending: 2, registry: 1, transfer: 1 });
	});
});

function sample(): AdminGuestRow {
	return fc.sample(row, 1)[0]!;
}
