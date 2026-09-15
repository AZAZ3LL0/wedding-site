<script lang="ts">
	import { tick } from 'svelte';
	import Cover from './Cover.svelte';
	import Envelope from './Envelope.svelte';
	import Invitation from './Invitation.svelte';

	let { data } = $props();

	const content = $derived(data.content);

	let covering = $state(false);
	let main: HTMLElement;
</script>

<svelte:head>
	<title>{content.cover.title}, {content.cover.eyebrow}</title>
	<link rel="preload" as="image" href={content.cover.photo.src} fetchpriority="high" />
</svelte:head>

<Envelope
	envelope={content.envelope}
	oncover={(value) => (covering = value)}
	onopen={async () => {
		// Wait for `inert` to leave the DOM, otherwise the browser refuses the focus.
		await tick();
		main.focus({ preventScroll: true });
	}}
/>

<main tabindex="-1" inert={covering} bind:this={main} class="outline-none">
	<Cover cover={content.cover} date={content.event.date} />
	<Invitation invitation={content.invitation} event={content.event} labels={content.ui.countdown} />
</main>
