<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { eventStart } from '$lib/content/event';
	import { Countdown, Heading, Reveal, Section } from '$lib/ui';

	type Props = {
		invitation: ContentData['invitation'];
		event: ContentData['event'];
		labels: ContentData['ui']['countdown'];
	};

	let { invitation, event, labels }: Props = $props();
</script>

<Section variant="light" aria-labelledby="invitation-title">
	<Reveal>
		<div class="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
			<p class="eyebrow text-olive">{invitation.eyebrow}</p>
			<div id="invitation-title">
				<Heading level={2} script>{invitation.title}</Heading>
			</div>
			<p class="flex flex-col gap-1 text-sm font-medium tracking-[0.18em] uppercase">
				<span>{invitation.dateLine}</span>
				<span>{invitation.timeLine}</span>
			</p>
			<p class="max-w-[30ch] text-xl leading-relaxed">{invitation.text}</p>
			<div class="mt-4 text-olive-deep">
				<Countdown target={eventStart(event)} {labels} />
			</div>
		</div>
	</Reveal>
</Section>
