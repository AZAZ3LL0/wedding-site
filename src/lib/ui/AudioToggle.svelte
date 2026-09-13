<script lang="ts">
	type Props = { src: string; labels: { play: string; pause: string } };

	let { src, labels }: Props = $props();

	let audio: HTMLAudioElement | undefined = $state();
	// Sound is off by default: browsers block autoplay and guests open the link in public places.
	let playing = $state(false);

	async function toggle() {
		if (!audio) return;
		if (playing) {
			audio.pause();
			playing = false;
			return;
		}
		try {
			await audio.play();
			playing = true;
		} catch {
			playing = false;
		}
	}
</script>

<button
	type="button"
	aria-pressed={playing}
	aria-label={playing ? labels.pause : labels.play}
	onclick={toggle}
	class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-current transition-opacity duration-(--dur-fast) hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2"
>
	<svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
		{#if playing}
			<path d="M7 5h3v14H7zM14 5h3v14h-3z" />
		{:else}
			<path d="M4 9h4l5-4v14l-5-4H4z" />
			<path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.5" />
		{/if}
	</svg>
</button>
<audio bind:this={audio} {src} preload="none" loop onpause={() => (playing = false)}></audio>
