<script lang="ts">
	import { page } from '$app/state';
	import { AudioToggle } from '$lib/ui';

	let { data, children } = $props();

	const music = $derived(data.content.music);
	const preview = $derived({
		title: data.content.entry.eyebrow,
		description: data.content.cover.text,
		// Messengers fetch the image on their own and need an absolute URL.
		image: new URL(data.content.cover.photo.src, page.url.origin).href,
		imageAlt: data.content.cover.photo.alt
	});
</script>

<svelte:head>
	<!-- The link guests share is `/`; messengers read these tags for the preview card. -->
	<meta name="description" content={preview.description} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="ru_RU" />
	<meta property="og:site_name" content={data.content.hosts} />
	<meta property="og:title" content={preview.title} />
	<meta property="og:description" content={preview.description} />
	<meta property="og:url" content={page.url.origin} />
	<meta property="og:image" content={preview.image} />
	<meta property="og:image:alt" content={preview.imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
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
