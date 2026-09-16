<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { MapCard, Reveal, Section } from '$lib/ui';
	import Flourish from './Flourish.svelte';
	import { places } from './places';

	type Props = {
		registry: ContentData['registry'];
		venue: ContentData['venue'];
		labels: ContentData['sections']['location'];
		linkLabel: string;
	};

	let { registry, venue, labels, linkLabel }: Props = $props();

	const list = $derived(places({ registry, venue, labels }));
</script>

<!-- No heading or gathering time on screen: the card above already gives both. The label stays
     for screen readers, so the map card is still a named region. -->
<Section variant="light" aria-label={labels.title} class="pt-0">
	<Reveal>
		<Flourish />
	</Reveal>

	<div class="mx-auto mt-10 flex max-w-md flex-col gap-10">
		{#each list as place, index (place.key)}
			<Reveal delay={index * 150}>
				<div data-place={place.key}>
					<MapCard
						title={place.title}
						address={place.address}
						mapUrl={place.mapUrl}
						photos={place.photos}
						{linkLabel}
					/>
				</div>
			</Reveal>
		{/each}
	</div>
</Section>
