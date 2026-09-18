<script lang="ts">
	import { onMount } from 'svelte';

	type Props = { src: string; labels: { play: string; pause: string } };

	let { src, labels }: Props = $props();

	// The guest's own choice, kept for the tab: once they switch the music off it stays off.
	const OFF_KEY = 'music-off';

	let audio: HTMLAudioElement | undefined = $state();
	let playing = $state(false);
	let stopped = $state(false);

	function remember(off: boolean) {
		try {
			if (off) sessionStorage.setItem(OFF_KEY, '1');
			else sessionStorage.removeItem(OFF_KEY);
		} catch {
			// Private mode and blocked storage throw; remembering is a convenience, not a requirement.
		}
	}

	async function start() {
		if (!audio || stopped || playing) return;
		try {
			await audio.play();
			playing = true;
		} catch {
			// Browsers refuse sound before the guest interacts; the next gesture tries again.
			playing = false;
		}
	}

	onMount(() => {
		try {
			stopped = sessionStorage.getItem(OFF_KEY) !== null;
		} catch {
			stopped = false;
		}

		void start();
		// The first tap or key press is usually the wax seal, and it is what lets the sound through.
		const onGesture = () => void start();
		addEventListener('pointerdown', onGesture, { passive: true });
		addEventListener('keydown', onGesture, { passive: true });
		return () => {
			removeEventListener('pointerdown', onGesture);
			removeEventListener('keydown', onGesture);
		};
	});

	async function toggle() {
		if (!audio) return;
		if (playing) {
			audio.pause();
			playing = false;
			stopped = true;
			remember(true);
			return;
		}
		stopped = false;
		remember(false);
		await start();
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
