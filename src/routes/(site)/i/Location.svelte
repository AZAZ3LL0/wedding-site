<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { Divider, Heading, MapCard, Reveal, Section } from '$lib/ui';
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

<Section variant="light" aria-labelledby="location-title" class="pt-0">
	<Reveal>
		<div class="mx-auto flex max-w-md flex-col items-center gap-6 text-center text-olive">
			<Divider orientation="vertical" />
			<p class="eyebrow">{labels.eyebrow}</p>
			<div id="location-title" class="text-ink">
				<Heading level={2} script>{labels.title}</Heading>
			</div>
		</div>
	</Reveal>

	<div class="mx-auto mt-10 flex max-w-md flex-col gap-10">
		{#each list as place, index (place.key)}
			<Reveal delay={index * 150}>
				<div class="flex flex-col gap-4" data-place={place.key}>
					<p class="text-center text-sm font-medium tracking-[0.18em] text-olive-deep uppercase">
						{place.times.join(' · ')}
					</p>
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
