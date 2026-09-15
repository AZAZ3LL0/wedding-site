<script lang="ts">
	import Cover from './Cover.svelte';
	import Invitation from './Invitation.svelte';

	let { data } = $props();

	const content = $derived(data.content);
</script>

<svelte:head>
	<title>{content.cover.title}, {content.cover.eyebrow}</title>
	<link rel="preload" as="image" href={content.cover.photo.src} fetchpriority="high" />
</svelte:head>

<main>
	<Cover cover={content.cover} date={content.event.date} />
	<Invitation invitation={content.invitation} event={content.event} labels={content.ui.countdown} />
</main>
