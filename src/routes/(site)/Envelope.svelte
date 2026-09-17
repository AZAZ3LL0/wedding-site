<script lang="ts">
	import { animate } from 'motion/mini';
	import { onMount } from 'svelte';
	import { motionTokens } from '$lib/actions/motion-tokens';
	import type { ContentData } from '$lib/content/schema';
	import {
		ENVELOPE_ART,
		ENVELOPE_LEAVING,
		ENVELOPE_OPENED,
		openingPlan,
		rememberOpened
	} from './envelope';

	type Props = {
		envelope: ContentData['envelope'];
		// Reports whether the envelope covers the page, so the page can make itself inert.
		oncover?: (covering: boolean) => void;
		onopen?: () => void;
	};

	let { envelope, oncover, onopen }: Props = $props();

	const id = $props.id();

	let root: HTMLElement;
	let heading: HTMLElement;
	let hint: HTMLElement;
	let seal: HTMLElement;
	let flap: HTMLElement;
	let stage: HTMLElement;
	let opening = $state(false);

	function releaseArt() {
		document.documentElement.classList.add(ENVELOPE_ART);
	}

	onMount(() => {
		// Tells the failsafe in app.html that JS is alive; otherwise it hides the envelope.
		document.documentElement.dataset.revealReady = '';
		// CSS decides visibility (JS, reduced motion, already opened), the component only follows it.
		const covering = getComputedStyle(root).display !== 'none';
		oncover?.(covering);
		if (!covering) return releaseArt();
		// Decoding the preloaded photo resolves once the envelope can paint; a failure still lets go.
		const photo = new Image();
		photo.src = '/images/envelope.webp';
		photo
			.decode()
			.catch(() => undefined)
			.finally(releaseArt);
	});

	function finish() {
		document.documentElement.classList.add(ENVELOPE_OPENED);
		rememberOpened(() => sessionStorage);
		oncover?.(false);
		opening = false;
		onopen?.();
	}

	async function open() {
		if (opening) return;
		opening = true;

		const { duration, ease } = motionTokens();
		const plan = openingPlan(duration);

		animate([heading, hint], { opacity: [1, 0] }, plan.seal);
		// The guest presses the wax in, and it gives.
		animate(
			seal,
			{ transform: ['scale(1)', 'scale(0.9)', 'scale(1.03)'] },
			{ ...plan.seal, ease: 'easeInOut' }
		);
		// The wax stays stuck to the flap, as real wax does: the flap carries its own copy of the seal,
		// so the button hands over to it the moment the flap starts to lift.
		setTimeout(() => (seal.style.visibility = 'hidden'), plan.flap.delay * 1000);
		animate(
			flap,
			{ transform: ['perspective(1400px) rotateX(0deg)', 'perspective(1400px) rotateX(-178deg)'] },
			{ ...plan.flap, ease: [0.6, 0, 0.3, 1] }
		);
		// The envelope sinks a little as it fades, and the card underneath rises into its place.
		setTimeout(
			() => document.documentElement.classList.add(ENVELOPE_LEAVING),
			plan.fade.delay * 1000
		);
		animate(stage, { transform: ['translateY(0)', 'translateY(6%)'] }, { ...plan.fade, ease });
		await animate(root, { opacity: [1, 0] }, { ...plan.fade, ease: 'easeOut' }).finished.catch(
			() => undefined
		);
		finish();
	}
</script>

<div
	class="envelope"
	class:opening
	role="dialog"
	aria-modal="true"
	aria-labelledby="{id}-title"
	bind:this={root}
>
	<div class="backdrop" aria-hidden="true"></div>

	<div class="heading" bind:this={heading}>
		<p class="eyebrow">{envelope.eyebrow}</p>
		<p class="title" id="{id}-title">{envelope.title}</p>
	</div>

	<div class="stage" bind:this={stage}>
		<div class="inside" aria-hidden="true"></div>

		<div class="body" aria-hidden="true"></div>

		<div class="flap" aria-hidden="true" bind:this={flap}>
			<div class="flap-front"></div>
			<div class="flap-back"></div>
		</div>

		<!-- The seal is the one control: pointer, keyboard and screen readers all open it here. -->
		<button type="button" class="seal" aria-label={envelope.open} onclick={open} bind:this={seal}>
			<img src="/images/envelope-seal.webp" alt="" width="295" height="295" />
		</button>
	</div>

	<p class="hint eyebrow" aria-hidden="true" bind:this={hint}>{envelope.open}</p>
</div>

<style>
	.envelope {
		/*
		 * The photo is 720 by 1280. The flap is the triangle whose sides run from the top edge down
		 * to the tip under the wax seal; the rest of the photo stays put while it opens.
		 */
		--flap: polygon(10.5% 0, 77% 0, 50% 47%);
		/* The whole envelope fits on screen; the blurred backdrop fills whatever is left over. */
		--stage-w: min(100vw, 100svh * 0.5625);

		position: fixed;
		inset: 0;
		z-index: 50;
		display: none;
		overflow: hidden;
		background: var(--c-accent-deep);
	}

	/* Shown only when JS runs, motion is welcome and the guest has not opened it in this tab. */
	@media (prefers-reduced-motion: no-preference) {
		:global(html.js:not(.envelope-opened)) .envelope {
			display: block;
		}

		:global(html.js:not(.envelope-opened) body) {
			overflow: hidden;
		}
	}

	/* The same photo, blurred and dimmed, fills whatever the envelope does not cover. */
	.backdrop {
		position: absolute;
		inset: -8%;
		background: url('/images/envelope.webp') center / cover;
		filter: blur(28px) brightness(0.72) saturate(1.1);
	}

	.heading {
		position: absolute;
		top: 6svh;
		right: 0;
		left: 0;
		z-index: 6;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		color: var(--c-ivory);
		text-align: center;
		text-shadow: 0 2px 14px color-mix(in oklab, black 45%, transparent);
	}

	.title {
		font-family: var(--font-script);
		font-size: clamp(2.25rem, 13vw, 4.5rem);
		line-height: 1.05;
		white-space: nowrap;
		color: color-mix(in oklab, var(--c-gold) 55%, var(--c-ivory));
	}

	/* Wider than a phone screen on purpose, so it is centred explicitly: a grid would pin its left edge. */
	.stage {
		position: absolute;
		top: 50%;
		left: 50%;
		width: var(--stage-w);
		aspect-ratio: 720 / 1280;
		translate: -50% -50%;
	}

	.inside,
	.body {
		position: absolute;
		inset: 0;
	}

	.body {
		z-index: 2;
		background: url('/images/envelope.webp') center / 100% 100%;
	}

	/* Behind the flap and over the envelope: what the guest sees once the flap swings up. */
	.inside {
		z-index: 3;
		clip-path: var(--flap);
		background: radial-gradient(
			ellipse 60% 70% at 50% 20%,
			color-mix(in oklab, var(--c-accent-deep) 70%, black),
			color-mix(in oklab, var(--c-accent-deep) 40%, black)
		);
	}

	.flap {
		position: absolute;
		inset: 0;
		z-index: 4;
		transform-origin: 50% 0;
		/* No filter here: a filter flattens 3D, and the back of the flap would never turn around. */
		transform-style: preserve-3d;
	}

	.flap-front,
	.flap-back {
		position: absolute;
		inset: 0;
		clip-path: var(--flap);
		backface-visibility: hidden;
	}

	.flap-front {
		background: url('/images/envelope.webp') center / 100% 100%;
	}

	/* Seen once the flap has swung past upright: plain cloth, darker than the printed side. */
	.flap-back {
		transform: rotateX(180deg);
		background: linear-gradient(
			color-mix(in oklab, var(--c-accent) 70%, black),
			color-mix(in oklab, var(--c-accent-deep) 80%, black)
		);
	}

	.seal {
		position: absolute;
		z-index: 5;
		top: 48.2%;
		left: 50%;
		width: 41%;
		aspect-ratio: 1;
		translate: -50% -50%;
		border-radius: 50%;
		cursor: pointer;
		transition: scale var(--dur-fast) var(--ease-out);
	}

	.seal img {
		display: block;
		width: 100%;
		height: 100%;
		filter: drop-shadow(0 10px 16px color-mix(in oklab, black 45%, transparent));
	}

	.seal:hover {
		scale: 1.05;
	}

	.seal:focus-visible {
		outline: 2px solid var(--c-gold);
		outline-offset: 6px;
	}

	/* A soft gold breath around the seal until it is pressed, so the guest knows where to tap. */
	@media (prefers-reduced-motion: no-preference) {
		.seal::after {
			content: '';
			position: absolute;
			inset: 14%;
			border-radius: 50%;
			pointer-events: none;
			animation: breathe 2.4s ease-in-out infinite;
		}

		.opening .seal::after {
			animation: none;
		}
	}

	@keyframes breathe {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in oklab, var(--c-gold) 0%, transparent);
		}
		50% {
			box-shadow: 0 0 22px 6px color-mix(in oklab, var(--c-gold) 45%, transparent);
		}
	}

	.hint {
		position: absolute;
		bottom: 6svh;
		left: 0;
		right: 0;
		z-index: 6;
		color: color-mix(in oklab, var(--c-gold) 60%, var(--c-ivory));
		text-align: center;
		text-shadow: 0 1px 10px color-mix(in oklab, black 45%, transparent);
		pointer-events: none;
	}
</style>
