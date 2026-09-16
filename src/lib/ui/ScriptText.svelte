<script lang="ts">
	import { displayScript } from './script-text';

	type Props = { text: string };

	let { text }: Props = $props();

	const shown = $derived(displayScript(text));
</script>

<!-- The swapped glyph is for the eye only; assistive tech and search read the Russian original.
     The spans touch, since a space between them would shift a centred title. -->
{#if shown === text}
	{text}
{:else}
	<span aria-hidden="true">{shown}</span><span class="sr-only">{text}</span>
{/if}
