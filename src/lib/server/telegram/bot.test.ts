import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rsvpPayloadSchema, type GuestPublic, type RsvpPublic } from '$lib/types';
import { applyDelta, menuChoice, type BotRsvpState, type RsvpDelta } from './bot';

const courses = [{ id: 'plov' }, { id: 'fish' }, { id: 'beef' }];

describe('menuChoice', () => {
	it.each([
		['course_1', 'plov'],
		['course_3', 'beef']
	])('reads %s as the matching dish', (command, id) => {
		expect(menuChoice(command, 'course_', courses)).toBe(id);
	});

	it.each(['course_0', 'course_4', 'course_', 'course_x', 'course_1.5', 'course_-1'])(
		'has no dish for %s',
		(command) => {
			expect(menuChoice(command, 'course_', courses)).toBeNull();
		}
	);

	it('has nothing to say about another prefix', () => {
		expect(menuChoice('drink_1', 'course_', courses)).toBeNull();
	});

	it('maps every in-range command back to its own option, and nothing else', () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: courses.length }), (position) => {
				expect(menuChoice(`course_${position}`, 'course_', courses)).toBe(
					courses[position - 1]!.id
				);
			})
		);
	});
});

const rsvp = (over: Partial<RsvpPublic> = {}): RsvpPublic => ({
	attending: 'yes',
	attendingRegistry: false,
	mainCourses: [],
	drinks: [],
	allergies: null,
	needsTransfer: false,
	songRequest: null,
	comment: null,
	updatedAt: '2026-10-01T08:00:00.000Z',
	...over
});

const guest = (answer: RsvpPublic | null): GuestPublic => ({
	id: '00000000-0000-4000-8000-000000000001',
	displayName: 'Петя',
	firstName: 'Пётр',
	audience: 'friends',
	invitedToRegistry: false,
	plusOnePolicy: 'allowed',
	isPlusOne: false,
	partyMembers: [],
	rsvp: answer
});

const state = (answer: RsvpPublic | null, over: Partial<BotRsvpState> = {}): BotRsvpState => ({
	guest: guest(answer),
	telegramUsername: 'petr_g',
	companion: null,
	...over
});

describe('applyDelta', () => {
	it('answers yes for a guest who has not answered yet', () => {
		const payload = applyDelta(state(null), { kind: 'attending', value: 'yes' }, false);

		expect(payload.attending).toBe('yes');
		expect(payload.mainCourses).toEqual([]);
	});

	it('replaces the dish when the menu allows only one', () => {
		const current = state(rsvp({ mainCourses: ['plov'] }));

		expect(applyDelta(current, { kind: 'course', id: 'fish' }, false).mainCourses).toEqual([
			'fish'
		]);
	});

	it('adds and removes a dish when the menu allows several', () => {
		const current = state(rsvp({ mainCourses: ['plov'] }));

		expect(applyDelta(current, { kind: 'course', id: 'fish' }, true).mainCourses).toEqual([
			'plov',
			'fish'
		]);
		expect(applyDelta(current, { kind: 'course', id: 'plov' }, true).mainCourses).toEqual([]);
	});

	it('toggles a drink', () => {
		const current = state(rsvp({ drinks: ['tea'] }));

		expect(applyDelta(current, { kind: 'drink', id: 'juice' }, false).drinks).toEqual([
			'tea',
			'juice'
		]);
		expect(applyDelta(current, { kind: 'drink', id: 'tea' }, false).drinks).toEqual([]);
	});

	it('carries the companion and the free text through an unrelated change', () => {
		const current = state(rsvp({ allergies: 'орехи', comment: 'приедем к шести' }), {
			companion: { firstName: 'Анна', lastName: 'Гостева', mainCourses: ['plov'], drinks: ['tea'] }
		});

		const payload = applyDelta(current, { kind: 'drink', id: 'juice' }, false);

		expect(payload).toMatchObject({
			allergies: 'орехи',
			comment: 'приедем к шести',
			telegramUsername: 'petr_g',
			companion: current.companion
		});
	});

	const deltaArb: fc.Arbitrary<RsvpDelta> = fc.oneof(
		fc.constantFrom<RsvpDelta>(
			{ kind: 'attending', value: 'yes' },
			{ kind: 'attending', value: 'no' }
		),
		fc
			.record({ kind: fc.constantFrom('course' as const, 'drink' as const), id: fc.string() })
			.map((d) => d as RsvpDelta)
	);

	const stateArb: fc.Arbitrary<BotRsvpState> = fc
		.record({
			mainCourses: fc.uniqueArray(fc.string({ minLength: 1 }), { maxLength: 3 }),
			drinks: fc.uniqueArray(fc.string({ minLength: 1 }), { maxLength: 3 }),
			allergies: fc.option(fc.string({ maxLength: 300 }), { nil: null }),
			comment: fc.option(fc.string({ maxLength: 1000 }), { nil: null }),
			songRequest: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
			needsTransfer: fc.boolean(),
			attendingRegistry: fc.boolean(),
			attending: fc.constantFrom('yes' as const, 'no' as const),
			telegramUsername: fc.option(fc.string({ maxLength: 64 }), { nil: null })
		})
		.map(({ telegramUsername, ...answer }) =>
			state(rsvp(answer), { telegramUsername, companion: null })
		);

	it('always produces a payload the shared rsvp schema accepts', () => {
		fc.assert(
			fc.property(stateArb, deltaArb, fc.boolean(), (current, delta, multiSelect) => {
				expect(rsvpPayloadSchema.safeParse(applyDelta(current, delta, multiSelect)).success).toBe(
					true
				);
			})
		);
	});

	it('changes only what the tap is about, never the free text or the username', () => {
		fc.assert(
			fc.property(stateArb, deltaArb, fc.boolean(), (current, delta, multiSelect) => {
				const payload = applyDelta(current, delta, multiSelect);
				const answer = current.guest.rsvp!;
				expect(payload).toMatchObject({
					allergies: answer.allergies,
					comment: answer.comment,
					songRequest: answer.songRequest,
					needsTransfer: answer.needsTransfer,
					attendingRegistry: answer.attendingRegistry,
					telegramUsername: current.telegramUsername
				});
			})
		);
	});

	it('toggling one drink twice puts the answer back where it started', () => {
		fc.assert(
			fc.property(stateArb, fc.string({ minLength: 1 }), (current, id) => {
				const once = applyDelta(current, { kind: 'drink', id }, false);
				const twice = applyDelta(
					state(rsvp({ ...current.guest.rsvp!, drinks: once.drinks }), {
						telegramUsername: current.telegramUsername
					}),
					{ kind: 'drink', id },
					false
				);
				expect(new Set(twice.drinks)).toEqual(new Set(current.guest.rsvp!.drinks));
			})
		);
	});
});
