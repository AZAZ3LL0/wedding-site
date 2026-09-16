<script lang="ts">
	import { displayScript } from './script-text';

	type Props = { text: string };

	let { text }: Props = $props();

	const shown = $derived(displayScript(text));
	// The borrowed capital A is wider than a Great Vibes letter, so it gets pulled in to its word.
	const parts = $derived(shown.split(/(A)/).filter(Boolean));
</script>

<!-- The swapped glyph is for the eye only; assistive tech and search read the Russian original.
     The spans touch, since a space between them would shift a centred title. -->
{#if shown === text}
	{text}
{:else}
	<span aria-hidden="true"
		>{#each parts as part, index (index)}{#if part === 'A'}<span class="capital-a">A</span
				>{:else}{part}{/if}{/each}</span
	><span class="sr-only">{text}</span>
{/if}

<style>
	.capital-a {
		margin-inline-end: -0.16em;
	}
</style>
