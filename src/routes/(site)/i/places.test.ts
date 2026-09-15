import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { content } from '$lib/content/wedding';
import { parseContent } from '$lib/content/schema';
import { places } from './places';

const parsed = parseContent(content);
const labels = parsed.sections.location;

const word = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() !== '');
const time = fc.constantFrom('TODO', '09:30', '14:00', '17:00');
const photos = fc.array(fc.record({ src: fc.constant('/images/a.webp'), alt: word }), {
	maxLength: 3
});
const registry = fc.option(
	fc.record({
		title: word,
		address: word,
		gatherTime: time,
		ceremonyTime: time,
		mapUrl: fc.constant('https://yandex.ru/maps/'),
		photos
	}),
	{ nil: null }
);

describe('places', () => {
	it('shows only the venue for this event, which has no registry', () => {
		expect(places({ registry: parsed.registry, venue: parsed.venue, labels })).toEqual([
			{
				key: 'venue',
				title: 'Банкетный зал «Европейский»',
				address: 'г. Астрахань, Каспийская улица, 2Б',
				mapUrl: parsed.venue.mapUrl,
				photos: [],
				times: ['Сбор гостей в 17:00']
			}
		]);
	});

	it('adds the registry before the venue exactly when there is one', () => {
		fc.assert(
			fc.property(registry, (r) => {
				const list = places({ registry: r, venue: parsed.venue, labels });
				expect(list.map((p) => p.key)).toEqual(r ? ['registry', 'venue'] : ['venue']);
				expect(list.at(-1)?.mapUrl).toBe(parsed.venue.mapUrl);
				if (r) {
					expect(list[0]).toMatchObject({ title: r.title, mapUrl: r.mapUrl, photos: r.photos });
					expect(list[0]?.times).toEqual([
						`${labels.registryGather} ${r.gatherTime}`,
						`${labels.registryCeremony} ${r.ceremonyTime}`
					]);
				}
			})
		);
	});
});
