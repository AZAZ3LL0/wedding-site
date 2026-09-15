import type { ContentData } from '$lib/content/schema';

export type Place = {
	key: 'registry' | 'venue';
	title: string;
	address: string;
	mapUrl: string;
	photos: { src: string; alt: string }[];
	times: string[];
};

type Source = Pick<ContentData, 'registry' | 'venue'> & {
	labels: ContentData['sections']['location'];
};

// The day's order: registry first when there is one, then the banquet.
export function places({ registry, venue, labels }: Source): Place[] {
	const list: Place[] = [];
	if (registry) {
		list.push({
			key: 'registry',
			title: registry.title,
			address: registry.address,
			mapUrl: registry.mapUrl,
			photos: registry.photos,
			times: [
				`${labels.registryGather} ${registry.gatherTime}`,
				`${labels.registryCeremony} ${registry.ceremonyTime}`
			]
		});
	}
	list.push({
		key: 'venue',
		title: venue.title,
		address: venue.address,
		mapUrl: venue.mapUrl,
		photos: venue.photos,
		times: [`${labels.venueStart} ${venue.startTime}`]
	});
	return list;
}
