<script lang="ts">
	import { resolve } from '$app/paths';
	import { Reveal, Section } from '$lib/ui';
	import Flourish from './Flourish.svelte';

	type Props = { label: string };

	let { label }: Props = $props();
</script>

<Section variant="light" class="pt-0">
	<Reveal>
		<div class="flex flex-col items-center gap-10">
			<Flourish />
			<!-- A link, not a Button: it navigates instead of submitting anything. -->
			<a
				href={resolve('/rsvp')}
				class="inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-10 py-4 text-lg font-medium tracking-wide text-ivory shadow-[0_0_0_1px_var(--c-gold),0_0_0_5px_var(--c-paper),0_0_0_6px_color-mix(in_oklab,var(--c-gold)_60%,transparent),0_14px_28px_rgb(79_17_28/0.28)] transition-colors duration-(--dur-fast) ease-out hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-accent"
				data-rsvp-link
			>
				{label}
			</a>
		</div>
	</Reveal>
</Section>
