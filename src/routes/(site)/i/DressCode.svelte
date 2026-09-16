<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { Heading, Reveal, Section } from '$lib/ui';
	import Flourish from './Flourish.svelte';

	type Props = {
		dressCode: ContentData['dressCode'];
		labels: ContentData['sections']['dressCode'];
	};

	let { dressCode, labels }: Props = $props();
</script>

<Section variant="light" aria-labelledby="dress-code-title" class="pt-0">
	<Reveal>
		<div class="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
			<Flourish />
			<p class="eyebrow text-accent">{labels.eyebrow}</p>
			<div id="dress-code-title" class="text-accent">
				<Heading level={2} script>{labels.title}</Heading>
			</div>

			{#if dressCode.palette.length > 0}
				<!-- Chips wide enough for the longest name: three to a row on a phone, all five on a laptop. -->
				<ul class="mt-2 flex w-full flex-wrap justify-center gap-x-3 gap-y-6">
					{#each dressCode.palette as color (color.hex)}
						<li class="flex w-20 flex-col items-center gap-3" data-swatch={color.hex}>
							<span
								class="aspect-square w-full max-w-18 rounded-full shadow-[inset_0_0_0_1px_rgb(58_34_38/0.12),0_6px_14px_rgb(79_17_28/0.16)] ring-1 ring-gold/60 ring-offset-4 ring-offset-paper"
								style:background-color={color.hex}
								aria-hidden="true"
							></span>
							<span
								class="text-[0.7rem] leading-tight tracking-[0.06em] text-balance text-accent uppercase"
								>{color.name}</span
							>
						</li>
					{/each}
				</ul>
			{/if}

			<p class="max-w-[30ch] text-xl leading-relaxed text-ink/85 italic">{dressCode.text}</p>
		</div>
	</Reveal>
</Section>
