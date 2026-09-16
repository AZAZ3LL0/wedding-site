<script lang="ts">
	import { tick } from 'svelte';
	import Answer from './Answer.svelte';
	import Cover from './Cover.svelte';
	import DressCode from './DressCode.svelte';
	import Envelope from '../Envelope.svelte';
	import Farewell from './Farewell.svelte';
	import Invitation from './Invitation.svelte';
	import Location from './Location.svelte';

	let { data } = $props();

	const content = $derived(data.content);

	let covering = $state(false);
	let main: HTMLElement;
</script>

<svelte:head>
	<title>{content.cover.title}, {content.event.title}</title>
	<!-- The closed envelope is the first screen; its photo and seal come before everything else. -->
	<link rel="preload" as="image" href="/images/envelope.webp" fetchpriority="high" />
	<link rel="preload" as="image" href="/images/envelope-seal.webp" fetchpriority="high" />
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

<div inert={covering}>
	<main tabindex="-1" bind:this={main} class="outline-none">
		<Cover
			cover={content.cover}
			event={content.event}
			venue={content.venue}
			hosts={content.hosts}
		/>
		<Invitation
			invitation={content.invitation}
			event={content.event}
			labels={content.ui.countdown}
			welcome={data.welcome}
		/>
		<Location
			registry={content.registry}
			venue={content.venue}
			labels={content.sections.location}
			linkLabel={content.ui.map.open}
		/>
		<DressCode dressCode={content.dressCode} labels={content.sections.dressCode} />
		<Answer
			answered={data.answered}
			label={data.answered ? content.rsvp.ctaAnswered : content.rsvp.cta}
		/>
	</main>

	<Farewell
		eyebrow={content.sections.farewell.eyebrow}
		monogram={content.envelope.monogram}
		hosts={content.hosts}
	/>
</div>
