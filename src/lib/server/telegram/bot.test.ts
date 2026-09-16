import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rsvpPayloadSchema, type GuestPublic, type RsvpPublic } from '$lib/types';
import { applyDelta, type BotRsvpState, type RsvpDelta } from './bot';

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
		const payload = applyDelta(state(null), { kind: 'attending', value: 'yes' });

		expect(payload.attending).toBe('yes');
	});

	it('carries the companion and the free text through a change of answer', () => {
		const current = state(rsvp({ allergies: 'орехи', comment: 'приедем к шести' }), {
			companion: { firstName: 'Анна', lastName: 'Гостева', mainCourses: [], drinks: [] }
		});

		expect(applyDelta(current, { kind: 'attending', value: 'no' })).toMatchObject({
			attending: 'no',
			allergies: 'орехи',
			comment: 'приедем к шести',
			telegramUsername: 'petr_g',
			companion: current.companion
		});
	});

	const deltaArb = fc.constantFrom<RsvpDelta>(
		{ kind: 'attending', value: 'yes' },
		{ kind: 'attending', value: 'no' }
	);

	const stateArb: fc.Arbitrary<BotRsvpState> = fc
		.record({
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
			fc.property(stateArb, deltaArb, (current, delta) => {
				expect(rsvpPayloadSchema.safeParse(applyDelta(current, delta)).success).toBe(true);
			})
		);
	});

	it('changes only the answer, never the free text or the username', () => {
		fc.assert(
			fc.property(stateArb, deltaArb, (current, delta) => {
				const answer = current.guest.rsvp!;
				expect(applyDelta(current, delta)).toMatchObject({
					attending: delta.value,
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
});
