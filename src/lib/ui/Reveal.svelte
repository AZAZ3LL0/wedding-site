<script lang="ts">
	import type { Snippet } from 'svelte';
	import { reveal } from '$lib/actions/reveal';

	type Props = { delay?: number; y?: number; children: Snippet };

	let { delay = 0, y = 24, children }: Props = $props();
</script>

<div data-reveal use:reveal={{ delay, y }}>
	{@render children()}
</div>
