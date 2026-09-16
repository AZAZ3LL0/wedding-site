<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { eventStart } from '$lib/content/event';
	import { Countdown, Reveal, Section } from '$lib/ui';
	import Flourish from './Flourish.svelte';

	type Props = {
		invitation: Pick<ContentData['invitation'], 'dateLine' | 'timeLine'>;
		event: ContentData['event'];
		labels: ContentData['ui']['countdown'];
		welcome: { greeting: string; name: string };
	};

	let { invitation, event, labels, welcome }: Props = $props();
</script>

<!-- The card already carries the text and the date; this block greets the guest and counts down. -->
<Section variant="light" aria-label={welcome.name} class="pt-10">
	<Reveal>
		<div class="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
			<Flourish />
			<p class="flex flex-col items-center gap-1" data-welcome>
				<span class="text-xl">{welcome.greeting}</span>
				<span class="font-script text-5xl text-accent">{welcome.name}</span>
			</p>
			<p class="flex flex-col gap-1 text-sm font-medium tracking-[0.18em] text-accent uppercase">
				<span>{invitation.dateLine}</span>
				<span>{invitation.timeLine}</span>
			</p>
			<div class="mt-2 w-full max-w-sm text-accent">
				<Countdown target={eventStart(event)} {labels} />
			</div>
		</div>
	</Reveal>
</Section>
