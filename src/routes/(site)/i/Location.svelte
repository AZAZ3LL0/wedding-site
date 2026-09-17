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
				<div class="framed" data-place={place.key}>
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

<style>
	/* Burgundy lace all round the card, cut from the photo: 560 by 560 with an 88 px band. */
	.framed {
		border: solid transparent;
		border-width: clamp(1.1rem, 6vw, 1.75rem);
		border-image-source: url('/images/lace-frame.webp');
		border-image-slice: 88;
		border-image-repeat: round;
	}

	/* Same gate as the arch: the lace waits for the envelope instead of loading with the first screen. */
	:global(html.js:not(.envelope-opened):not(.envelope-art)) .framed {
		border-image-source: none;
	}
</style>
