import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContent } from './schema';
import { content } from './wedding';

type Mutable = Record<string, unknown>;

function base(): Mutable {
	return structuredClone(content) as unknown as Mutable;
}

function at(target: Mutable, path: readonly string[]): Mutable {
	return path.reduce((node, key) => node[key] as Mutable, target);
}

function withValue(path: readonly string[], value: unknown): Mutable {
	const next = base();
	at(next, path.slice(0, -1))[path.at(-1)!] = value;
	return next;
}

function without(path: readonly string[]): Mutable {
	const next = base();
	delete at(next, path.slice(0, -1))[path.at(-1)!];
	return next;
}

const contact = { role: 'Сестра невесты', name: 'Дина', phone: '+7 900 000-00-00', telegram: null };

describe('parseContent', () => {
	it('accepts wedding.ts with its placeholders', () => {
		expect(() => parseContent(content)).not.toThrow();
	});

	it('accepts TODO in display-only fields', () => {
		const registry = {
			title: 'TODO',
			address: 'TODO',
			gatherTime: 'TODO',
			ceremonyTime: 'TODO',
			mapUrl: 'TODO'
		};
		expect(parseContent(withValue(['registry'], registry)).registry).toEqual({
			...registry,
			photos: []
		});
	});

	it.each<[string, Mutable]>([
		['a missing required field', without(['couple', 'bride'])],
		['an unknown key', withValue(['gallery'], [])],
		['an unknown nested key', withValue(['event', 'timezone'], 'Europe/Astrakhan')],
		['blank text', withValue(['hosts'], '   ')],
		['an impossible date', withValue(['event', 'date'], '2026-02-30')],
		['TODO in the event date', withValue(['event', 'date'], 'TODO')],
		['an hour past 23', withValue(['event', 'time'], '24:00')],
		['an offset without a leading zero', withValue(['event', 'utcOffset'], '+4:00')],
		['an RSVP deadline after the event', withValue(['event', 'rsvpDeadline'], '2026-11-29')],
		['a display time in free form', withValue(['venue', 'startTime'], '5pm')],
		['a plain http map link', withValue(['venue', 'mapUrl'], 'http://yandex.ru/maps/')],
		['a map link without a scheme', withValue(['venue', 'mapUrl'], 'yandex.ru/maps')],
		['a relative image path', withValue(['cover', 'photo'], { src: 'images/a.jpg', alt: 'Фото' })],
		['a protocol-relative image', withValue(['cover', 'photo'], { src: '//x.io/a.jpg', alt: 'Ф' })],
		['an image without alt', withValue(['cover', 'photo'], { src: '/images/a.jpg', alt: '' })],
		['a short hex color', withValue(['dressCode', 'palette'], [{ hex: '#fff', name: 'белый' }])],
		[
			'an unknown timeline icon',
			withValue(['timeline'], [{ time: '17:00', title: 'Сбор', caption: 'Холл', icon: 'star' }])
		],
		['a contact without phone or telegram', withValue(['contacts'], [{ ...contact, phone: null }])],
		['a telegram username with @', withValue(['contacts'], [{ ...contact, telegram: '@alina' }])],
		[
			'duplicate menu ids',
			withValue(
				['menu', 'courses'],
				[
					{ id: 'plov', label: 'Плов' },
					{ id: 'plov', label: 'Плов с бараниной' }
				]
			)
		],
		['a menu id that is not a slug', withValue(['menu', 'drinks'], [{ id: 'Сок', label: 'Сок' }])],
		['two plural forms instead of three', withValue(['ui', 'countdown', 'days'], ['день', 'дня'])],
		['a missing audience', without(['byAudience', 'colleagues'])],
		['an audience without a label', without(['byAudience', 'friends', 'label'])],
		['a blank entry title', withValue(['entry', 'title'], ' ')],
		['unknown request copy without a submit label', without(['unknown', 'submit'])],
		['rsvp copy without the closed notice', without(['rsvp', 'closed'])],
		['a blank rsvp submit label', withValue(['rsvp', 'submit'], '  ')],
		['thanks copy without the edit link', without(['thanks', 'edit'])],
		['an unknown form of address', withValue(['byAudience', 'family', 'address'], 'Вы')],
		['a music path from the page', withValue(['music', 'src'], 'audio/track.mp3')]
	])('rejects %s', (_, raw) => {
		expect(() => parseContent(raw)).toThrow(/Invalid content/);
	});

	it('names the broken field without echoing its value', () => {
		const raw = withValue(['event', 'rsvpDeadline'], '2031-01-01');
		expect(() => parseContent(raw)).toThrow(/event\.rsvpDeadline: rsvpDeadline is after/);
		expect(() => parseContent(raw)).not.toThrow(/2031/);
	});
});

// Fields that may be omitted, with the value the schema fills in (tech.md §7).
const defaulted = [
	{ path: ['registry'], fallback: null },
	{ path: ['venue', 'photos'], fallback: [] },
	{ path: ['timeline'], fallback: [] },
	{ path: ['dressCode', 'palette'], fallback: [] },
	{ path: ['gifts'], fallback: null },
	{ path: ['transfer'], fallback: null },
	{ path: ['contacts'], fallback: [] },
	{ path: ['menu', 'multiSelect'], fallback: false }
] as const;

const word = fc
	.string({ minLength: 1, maxLength: 24 })
	.filter((s) => s.trim() !== '' && s !== 'TODO');
const time = fc
	.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
	.map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
const image = fc.record({
	src: fc.stringMatching(/^[a-z0-9-]{1,12}$/).map((name) => `/images/${name}.webp`),
	alt: word
});

// Non-default values for every defaulted field, so an omitted field is distinguishable.
const explicitValues = fc.record({
	registry: fc.record({
		title: word,
		address: word,
		gatherTime: time,
		ceremonyTime: time,
		mapUrl: fc.constant('https://yandex.ru/maps/'),
		photos: fc.array(image, { maxLength: 3 })
	}),
	photos: fc.array(image, { minLength: 1, maxLength: 3 }),
	timeline: fc.array(
		fc.record({ time, title: word, caption: word, icon: fc.constantFrom('pin', 'rings', 'dish') }),
		{ minLength: 1, maxLength: 4 }
	),
	palette: fc.array(
		fc.record({
			hex: fc.stringMatching(/^[0-9a-f]{6}$/).map((h) => `#${h}`),
			name: word
		}),
		{ minLength: 1, maxLength: 5 }
	),
	gifts: word,
	transfer: fc.record({ route: word, time }),
	contacts: fc.array(
		fc.record({
			role: word,
			name: word,
			phone: fc.constant('+7 900 000-00-00'),
			telegram: fc.option(fc.stringMatching(/^[a-z0-9_]{5,12}$/), { nil: null })
		}),
		{ minLength: 1, maxLength: 3 }
	),
	multiSelect: fc.constant(true)
});

type ExplicitValues = typeof explicitValues extends fc.Arbitrary<infer T> ? T : never;

function fullConfig(values: ExplicitValues): Mutable {
	const raw = base();
	raw.registry = values.registry;
	at(raw, ['venue']).photos = values.photos;
	raw.timeline = values.timeline;
	at(raw, ['dressCode']).palette = values.palette;
	raw.gifts = values.gifts;
	raw.transfer = values.transfer;
	raw.contacts = values.contacts;
	at(raw, ['menu']).multiSelect = values.multiSelect;
	return raw;
}

describe('content defaults', () => {
	it('fills exactly the documented default for omitted fields and keeps the rest', () => {
		fc.assert(
			fc.property(explicitValues, fc.subarray([...defaulted]), (values, omitted) => {
				const full = fullConfig(values);
				const expected = parseContent(full) as unknown as Mutable;

				const partial = structuredClone(full);
				for (const { path } of omitted) delete at(partial, path.slice(0, -1))[path.at(-1)!];
				const parsed = parseContent(partial) as unknown as Mutable;

				for (const { path, fallback } of omitted) {
					at(expected, path.slice(0, -1))[path.at(-1)!] = fallback;
				}
				expect(parsed).toEqual(expected);
			})
		);
	});

	it('keeps explicit values untouched', () => {
		fc.assert(
			fc.property(explicitValues, (values) => {
				const full = fullConfig(values);
				expect(parseContent(full)).toEqual(full);
			})
		);
	});

	it('is idempotent on its own output', () => {
		fc.assert(
			fc.property(explicitValues, fc.subarray([...defaulted]), (values, omitted) => {
				const partial = fullConfig(values);
				for (const { path } of omitted) delete at(partial, path.slice(0, -1))[path.at(-1)!];
				const once = parseContent(partial);
				expect(parseContent(once)).toEqual(once);
			})
		);
	});
});
