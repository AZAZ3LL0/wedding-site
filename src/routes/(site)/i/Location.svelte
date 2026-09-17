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
	/* Burgundy lace laid under the card, as in the printed invitation: only its edge shows. */
	.framed {
		position: relative;
		isolation: isolate;
	}

	.framed::before,
	.framed::after {
		content: '';
		position: absolute;
		left: 50%;
		z-index: -1;
		width: calc(100% + 1.5rem);
		/* The fringe cut out of the photo, 410 by 82, laid across the card's width. */
		aspect-ratio: 410 / 82;
		translate: -50% 0;
		background-color: var(--c-accent);
		mask-image: url('/images/lace-edge.png');
		mask-size: 100% 100%;
		mask-position: center;
		mask-repeat: no-repeat;
	}

	.framed::before {
		bottom: calc(100% - 1.25rem);
		rotate: 180deg;
	}

	.framed::after {
		top: calc(100% - 1.25rem);
	}

	/* Same gate as the arch: the lace waits for the envelope instead of loading with the first screen. */
	:global(html.js:not(.envelope-opened):not(.envelope-art)) .framed::before,
	:global(html.js:not(.envelope-opened):not(.envelope-art)) .framed::after {
		display: none;
	}
</style>
