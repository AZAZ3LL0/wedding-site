<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { eventStart } from '$lib/content/event';
	import { Countdown, Reveal, Section } from '$lib/ui';
	import Flourish from './Flourish.svelte';

	type Props = {
		event: ContentData['event'];
		labels: ContentData['ui']['countdown'];
	};

	let { event, labels }: Props = $props();
</script>

<!-- The card already says who, when and where; below it only the countdown remains. -->
<Section variant="light" class="pt-10">
	<Reveal>
		<div class="mx-auto flex max-w-sm flex-col items-center gap-8 text-accent">
			<Flourish />
			<div class="w-full">
				<Countdown target={eventStart(event)} {labels} />
			</div>
		</div>
	</Reveal>
</Section>
