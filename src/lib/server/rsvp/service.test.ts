import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContent, type ContentData } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import { rsvpPayloadSchema, type RsvpPayload } from '$lib/types';
import { showsRegistry } from '$lib/server/guests/segment';
import {
	checkRsvp,
	isRsvpOpen,
	normalizeTelegramUsername,
	rsvpClosesAt,
	type RulesContent,
	type RulesGuest
} from './service';

const base = parseContent(raw);

const registry = {
	title: 'Дворец бракосочетания',
	address: 'ул. Ленина, 1',
	gatherTime: '11:00',
	ceremonyTime: '11:30',
	mapUrl: 'https://yandex.ru/maps/',
	photos: []
};

const courses = ['plov', 'beshbarmak', 'fish'];
const drinks = ['tea', 'juice', 'wine'];
const option = (id: string) => ({ id, label: id });

const contentArb: fc.Arbitrary<RulesContent> = fc
	.record({
		multiSelect: fc.boolean(),
		hasRegistry: fc.boolean(),
		hasTransfer: fc.boolean(),
		showRegistry: fc.boolean()
	})
	.map(({ multiSelect, hasRegistry, hasTransfer, showRegistry }) => ({
		menu: { multiSelect, courses: courses.map(option), drinks: drinks.map(option) },
		registry: hasRegistry ? registry : null,
		transfer: hasTransfer ? { route: 'От ЗАГСа до зала', time: '16:00' } : null,
		byAudience: {
			...base.byAudience,
			family: { ...base.byAudience.family, showRegistry }
		}
	}));

const guestArb: fc.Arbitrary<RulesGuest> = fc.record({
	audience: fc.constantFrom('family', 'friends', 'colleagues'),
	invitedToRegistry: fc.boolean(),
	plusOnePolicy: fc.constantFrom('none', 'allowed'),
	displayName: fc.constant('Гость')
});

const pick = (ids: string[]) => fc.subarray(ids, { maxLength: ids.length });
const text = (max: number) => fc.option(fc.string({ maxLength: max }), { nil: null });

const companionArb = fc.record({
	firstName: fc.string({ minLength: 1, maxLength: 60 }),
	lastName: fc.string({ maxLength: 60 }),
	mainCourses: pick(courses).map((ids) => ids.slice(0, 1)),
	drinks: pick(drinks)
});

// Payloads that pass rsvpPayloadSchema, with menu ids from the content above.
const payloadArb: fc.Arbitrary<RsvpPayload> = fc.record({
	attending: fc.constantFrom('yes', 'no'),
	attendingRegistry: fc.boolean(),
	mainCourses: pick(courses),
	drinks: pick(drinks),
	allergies: text(300),
	needsTransfer: fc.boolean(),
	songRequest: text(200),
	comment: text(1000),
	telegramUsername: text(64),
	companion: fc.option(companionArb, { nil: null })
});

const unknownIdArb = fc
	.stringMatching(/^[a-z0-9-]{1,12}$/)
	.filter((id) => !courses.includes(id) && !drinks.includes(id));

function payload(overrides: Partial<RsvpPayload> = {}): RsvpPayload {
	return rsvpPayloadSchema.parse({ attending: 'yes', ...overrides });
}

const allowed: RulesGuest = {
	audience: 'friends',
	invitedToRegistry: false,
	plusOnePolicy: 'allowed',
	displayName: 'Лёша'
};

const menuContent: RulesContent = {
	menu: { multiSelect: false, courses: courses.map(option), drinks: drinks.map(option) },
	registry: null,
	transfer: null,
	byAudience: base.byAudience
};

describe('checkRsvp: companion rules', () => {
	it('rejects any companion when the party allows no plus one', () => {
		fc.assert(
			fc.property(
				payloadArb,
				companionArb,
				guestArb,
				contentArb,
				(p, companion, guest, content) => {
					const result = checkRsvp(
						{ ...p, companion },
						{ ...guest, plusOnePolicy: 'none' },
						content
					);
					expect(result).toEqual({ ok: false, reason: 'companionNotAllowed' });
				}
			)
		);
	});

	it('rejects a companion of a guest who is not coming', () => {
		fc.assert(
			fc.property(
				payloadArb,
				companionArb,
				guestArb,
				contentArb,
				(p, companion, guest, content) => {
					const result = checkRsvp(
						{ ...p, attending: 'no', companion },
						{ ...guest, plusOnePolicy: 'allowed' },
						content
					);
					expect(result).toEqual({ ok: false, reason: 'companionNotAttending' });
				}
			)
		);
	});
});

describe('checkRsvp: menu ids', () => {
	it('rejects an unknown course or drink id of a guest who comes', () => {
		fc.assert(
			fc.property(
				payloadArb,
				unknownIdArb,
				fc.constantFrom('mainCourses', 'drinks') as fc.Arbitrary<'mainCourses' | 'drinks'>,
				(p, unknownId, field) => {
					const answer = { ...p, attending: 'yes' as const, companion: null };
					answer[field] = [...answer[field], unknownId];
					expect(checkRsvp(answer, allowed, menuContent)).toEqual({
						ok: false,
						reason: 'unknownOption'
					});
				}
			)
		);
	});

	it('rejects an unknown id in the companion menu', () => {
		const companion = { firstName: 'Ольга', lastName: '', mainCourses: ['lagman'], drinks: [] };
		expect(checkRsvp(payload({ companion }), allowed, menuContent)).toEqual({
			ok: false,
			reason: 'unknownOption'
		});
	});

	it('rejects the placeholder id once the real menu replaces it', () => {
		expect(checkRsvp(payload({ mainCourses: ['todo-course'] }), allowed, menuContent)).toEqual({
			ok: false,
			reason: 'unknownOption'
		});
	});

	it('rejects a repeated id', () => {
		expect(checkRsvp(payload({ drinks: ['tea', 'tea'] }), allowed, menuContent)).toEqual({
			ok: false,
			reason: 'repeatedOption'
		});
	});

	it('allows one course unless the menu is multi-select, for the companion too', () => {
		const two = ['plov', 'fish'];
		const multi = { ...menuContent, menu: { ...menuContent.menu, multiSelect: true } };
		const companion = { firstName: 'Ольга', lastName: '', mainCourses: two, drinks: [] };

		expect(checkRsvp(payload({ mainCourses: two }), allowed, menuContent)).toEqual({
			ok: false,
			reason: 'tooManyCourses'
		});
		expect(checkRsvp(payload({ companion }), allowed, menuContent)).toEqual({
			ok: false,
			reason: 'tooManyCourses'
		});
		expect(checkRsvp(payload({ mainCourses: two, companion }), allowed, multi).ok).toBe(true);
	});

	it('accepts known ids and keeps them as chosen', () => {
		fc.assert(
			fc.property(payloadArb, guestArb, contentArb, (p, guest, content) => {
				const answer = {
					...p,
					attending: 'yes' as const,
					mainCourses: content.menu.multiSelect ? p.mainCourses : p.mainCourses.slice(0, 1),
					companion: guest.plusOnePolicy === 'allowed' ? p.companion : null
				};
				const result = checkRsvp(answer, guest, content);
				expect(result.ok).toBe(true);
				if (!result.ok) return;
				expect(result.value.answer.mainCourses).toEqual(answer.mainCourses);
				expect(result.value.answer.drinks).toEqual(answer.drinks);
				expect(result.value.companion).toEqual(answer.companion);
			})
		);
	});
});

describe('checkRsvp: forced values', () => {
	it('keeps the registry only when the guest sees the registry block', () => {
		fc.assert(
			fc.property(payloadArb, guestArb, contentArb, (p, guest, content) => {
				const result = checkRsvp(
					{ ...p, attending: 'yes', mainCourses: [], companion: null },
					guest,
					content
				);
				expect(result.ok && result.value.answer.attendingRegistry).toBe(
					p.attendingRegistry && showsRegistry(guest, content)
				);
				// Invariant 4 from tech.md §4.
				if (result.ok && result.value.answer.attendingRegistry) {
					expect(guest.invitedToRegistry).toBe(true);
				}
			})
		);
	});

	it('turns the transfer off when the content offers none', () => {
		fc.assert(
			fc.property(payloadArb, guestArb, contentArb, (p, guest, content) => {
				const result = checkRsvp(
					{ ...p, attending: 'yes', mainCourses: [], companion: null },
					guest,
					content
				);
				expect(result.ok && result.value.answer.needsTransfer).toBe(
					p.needsTransfer && content.transfer !== null
				);
			})
		);
	});

	it('clears menu, registry, transfer and allergies of a guest who is not coming', () => {
		fc.assert(
			fc.property(payloadArb, guestArb, contentArb, (p, guest, content) => {
				const result = checkRsvp({ ...p, attending: 'no', companion: null }, guest, content);
				expect(result.ok).toBe(true);
				if (!result.ok) return;
				expect(result.value.answer).toMatchObject({
					attending: 'no',
					attendingRegistry: false,
					mainCourses: [],
					drinks: [],
					allergies: null,
					needsTransfer: false
				});
			})
		);
	});

	it('keeps the comment and the username of a guest who is not coming', () => {
		const result = checkRsvp(
			payload({ attending: 'no', comment: 'Буду в отъезде', telegramUsername: '@ivan' }),
			allowed,
			menuContent
		);
		expect(result).toMatchObject({
			ok: true,
			value: { answer: { comment: 'Буду в отъезде' }, telegramUsername: 'ivan' }
		});
	});

	it('stores blank text as null', () => {
		const result = checkRsvp(payload({ allergies: '  ', comment: '' }), allowed, menuContent);
		expect(result).toMatchObject({
			ok: true,
			value: { answer: { allergies: null, comment: null } }
		});
	});
});

describe('rsvp deadline', () => {
	const offsetArb = fc
		.record({
			sign: fc.constantFrom('+', '-'),
			hours: fc.integer({ min: 0, max: 14 }),
			minutes: fc.constantFrom(0, 30, 45)
		})
		.map(
			({ sign, hours, minutes }) =>
				`${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
		);
	const dateArb = fc
		.date({
			min: new Date('2026-01-01T00:00:00Z'),
			max: new Date('2027-12-31T00:00:00Z'),
			noInvalidDate: true
		})
		.map((d) => d.toISOString().slice(0, 10));

	it('stays open until the midnight that ends the deadline day at the venue', () => {
		fc.assert(
			fc.property(dateArb, offsetArb, (rsvpDeadline, utcOffset) => {
				const event = { rsvpDeadline, utcOffset };
				const closesAt = rsvpClosesAt(event).getTime();
				const dayStart = new Date(`${rsvpDeadline}T00:00:00${utcOffset}`).getTime();

				expect(closesAt - dayStart).toBe(24 * 60 * 60 * 1000);
				expect(isRsvpOpen(event, new Date(dayStart))).toBe(true);
				expect(isRsvpOpen(event, new Date(closesAt - 1))).toBe(true);
				expect(isRsvpOpen(event, new Date(closesAt))).toBe(false);
				expect(isRsvpOpen(event, new Date(closesAt + 1))).toBe(false);
			})
		);
	});

	it('closes this event at 14 November 24:00 in Astrakhan, which is 20:00 UTC', () => {
		expect(rsvpClosesAt({ rsvpDeadline: '2026-11-14', utcOffset: '+04:00' }).toISOString()).toBe(
			'2026-11-14T20:00:00.000Z'
		);
	});
});

describe('normalizeTelegramUsername', () => {
	const handle = fc.stringMatching(/^[A-Za-z0-9_]{1,32}$/);

	it('drops a leading @ and surrounding spaces', () => {
		fc.assert(
			fc.property(handle, fc.stringMatching(/^ {0,3}$/), (name, pad) => {
				expect(normalizeTelegramUsername(`${pad}@${name}${pad}`)).toBe(name);
				expect(normalizeTelegramUsername(name)).toBe(name);
			})
		);
	});

	it('is idempotent', () => {
		fc.assert(
			fc.property(text(64), (value) => {
				const once = normalizeTelegramUsername(value);
				expect(normalizeTelegramUsername(once)).toBe(once);
			})
		);
	});

	it('turns an empty value into null', () => {
		expect(normalizeTelegramUsername('')).toBeNull();
		expect(normalizeTelegramUsername(' @ ')).toBeNull();
		expect(normalizeTelegramUsername(null)).toBeNull();
	});
});

// Keeps the fixture honest: the content under test must parse like wedding.ts does.
it('builds content fixtures that the real schema would accept', () => {
	const full: ContentData = { ...base, ...menuContent };
	expect(() => parseContent(full)).not.toThrow();
});
