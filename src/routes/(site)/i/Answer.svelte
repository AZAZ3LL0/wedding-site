<script lang="ts">
	import { resolve } from '$app/paths';
	import { Divider, Reveal, Section } from '$lib/ui';

	type Props = { answered: boolean; label: string };

	let { answered, label }: Props = $props();
</script>

<Section variant="light" class="pt-0">
	<Reveal>
		<div class="flex flex-col items-center gap-8 text-olive">
			<Divider orientation="vertical" />
			<!-- A link, not a Button: it navigates instead of submitting anything. -->
			<a
				href={answered ? resolve('/thanks') : resolve('/rsvp')}
				class="inline-flex min-h-11 items-center justify-center rounded-token bg-olive px-8 py-3 font-medium text-ivory transition-colors duration-(--dur-fast) ease-out hover:bg-olive-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
				data-rsvp-link
			>
				{label}
			</a>
		</div>
	</Reveal>
</Section>
