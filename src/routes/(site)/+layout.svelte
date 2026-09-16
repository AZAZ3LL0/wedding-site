<script lang="ts">
	import { AudioToggle } from '$lib/ui';

	let { data, children } = $props();

	const music = $derived(data.content.music);
</script>

<svelte:head>
	<!-- Cyrillic subsets draw the first screen; preloading them keeps the text from swapping late. -->
	<link
		rel="preload"
		href="/fonts/great-vibes-cyrillic-400.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		href="/fonts/cormorant-garamond-cyrillic-wght.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
</svelte:head>

{#if music.enabled}
	<!-- In the layout, so the track keeps playing when the guest moves between site pages. -->
	<div class="fixed top-4 right-4 z-30 rounded-full bg-paper/85 text-accent-deep backdrop-blur-sm">
		<AudioToggle src={music.src} labels={data.content.ui.audio} />
	</div>
{/if}

{@render children()}
