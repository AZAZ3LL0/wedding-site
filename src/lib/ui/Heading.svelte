<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { level: 1 | 2 | 3; script?: boolean; children: Snippet };

	let { level, script = false, children }: Props = $props();

	// A long script word like «Представьтесь,» outgrows a 320 px screen at 3rem, so level 1 scales down there.
	const size = {
		1: 'text-[clamp(2.25rem,11.5vw,3rem)] sm:text-6xl',
		2: 'text-4xl sm:text-5xl',
		3: 'text-2xl sm:text-3xl'
	};
</script>

<svelte:element
	this={`h${level}`}
	class={[
		'leading-tight text-balance',
		script ? 'font-script font-normal' : 'font-display font-medium',
		size[level]
	]}
>
	{@render children()}
</svelte:element>
