import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContent, type ContentData } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import type { Audience } from '$lib/types';
import { places } from '../../../routes/(site)/i/places';
import { segmentContent, showsRegistry, welcome } from './segment';

const base = parseContent(raw);
const audiences: Audience[] = ['family', 'friends', 'colleagues'];

const registry = {
	title: 'Дворец бракосочетания',
	address: 'ул. Ленина, 1',
	gatherTime: '11:00',
	ceremonyTime: '11:30',
	mapUrl: 'https://yandex.ru/maps/',
	photos: []
};

const word = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() !== '');

const contentArb = fc
	.record({
		hasRegistry: fc.boolean(),
		show: fc.record({ family: fc.boolean(), friends: fc.boolean(), colleagues: fc.boolean() }),
		greeting: fc.record({ family: word, friends: word, colleagues: word })
	})
	.map(({ hasRegistry, show, greeting }): ContentData => ({
		...base,
		registry: hasRegistry ? registry : null,
		byAudience: {
			family: { ...base.byAudience.family, showRegistry: show.family, greeting: greeting.family },
			friends: {
				...base.byAudience.friends,
				showRegistry: show.friends,
				greeting: greeting.friends
			},
			colleagues: {
				...base.byAudience.colleagues,
				showRegistry: show.colleagues,
				greeting: greeting.colleagues
			}
		}
	}));

const guestArb = fc.record({
	audience: fc.constantFrom(...audiences),
	invitedToRegistry: fc.boolean(),
	displayName: word
});

describe('showsRegistry', () => {
	it('is true only when there is a registry, the audience shows it and the party is invited', () => {
		fc.assert(
			fc.property(contentArb, guestArb, (content, guest) => {
				expect(showsRegistry(guest, content)).toBe(
					content.registry !== null &&
						content.byAudience[guest.audience].showRegistry &&
						guest.invitedToRegistry
				);
			})
		);
	});

	it('hides the registry from a guest without an invitation whatever the audience says', () => {
		fc.assert(
			fc.property(contentArb, guestArb, (content, guest) => {
				expect(showsRegistry({ ...guest, invitedToRegistry: false }, content)).toBe(false);
			})
		);
	});

	it('hides it from every audience of this event, which has no registry', () => {
		for (const audience of audiences) {
			const guest = { audience, invitedToRegistry: true, displayName: 'Иван' };
			expect(showsRegistry(guest, base)).toBe(false);
		}
	});
});

describe('segmentContent', () => {
	it('drops a hidden registry and changes nothing else', () => {
		fc.assert(
			fc.property(contentArb, fc.option(guestArb, { nil: null }), (content, guest) => {
				const segmented = segmentContent(content, guest);
				const visible = showsRegistry(guest, content);

				expect(segmented.registry).toEqual(visible ? content.registry : null);
				expect({ ...segmented, registry: null }).toEqual({ ...content, registry: null });
				// Location times come from the same data, so hiding the block hides the times too.
				const keys = places({
					registry: segmented.registry,
					venue: segmented.venue,
					labels: segmented.sections.location
				}).map((p) => p.key);
				expect(keys).toEqual(visible ? ['registry', 'venue'] : ['venue']);
			})
		);
	});

	it('shows a visitor without a session no registry', () => {
		fc.assert(
			fc.property(contentArb, (content) => {
				expect(segmentContent(content, null).registry).toBeNull();
			})
		);
	});

	it('keeps an invited family guest’s registry when the audience shows it', () => {
		const content = { ...base, registry };
		const guest = { audience: 'family' as const, invitedToRegistry: true, displayName: 'Иван' };
		expect(base.byAudience.family.showRegistry).toBe(true);
		expect(segmentContent(content, guest).registry).toEqual(registry);
		expect(segmentContent(content, { ...guest, audience: 'friends' }).registry).toBeNull();
	});
});

describe('welcome', () => {
	it('addresses the guest with their audience greeting and display name', () => {
		fc.assert(
			fc.property(contentArb, guestArb, (content, guest) => {
				expect(welcome(guest, content)).toEqual({
					greeting: content.byAudience[guest.audience].greeting,
					name: guest.displayName
				});
			})
		);
	});
});
