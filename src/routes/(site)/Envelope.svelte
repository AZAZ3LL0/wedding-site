<script lang="ts">
	import { animate } from 'motion/mini';
	import { onMount } from 'svelte';
	import { motionTokens } from '$lib/actions/motion-tokens';
	import type { ContentData } from '$lib/content/schema';
	import { ENVELOPE_LEAVING, ENVELOPE_OPENED, openingPlan, rememberOpened } from './envelope';

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

	onMount(() => {
		// Tells the failsafe in app.html that JS is alive; otherwise it hides the envelope.
		document.documentElement.dataset.revealReady = '';
		// CSS decides visibility (JS, reduced motion, already opened), the component only follows it.
		oncover?.(getComputedStyle(root).display !== 'none');
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

<!-- Fresh wax over the rose pressed into the photo, carrying the hosts' monogram instead. -->
{#snippet wax(place: string)}
	<span class="wax {place}" aria-hidden="true">
		<span class="monogram">{envelope.monogram}</span>
	</span>
{/snippet}

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
			<div class="flap-front">
				{@render wax('flap-wax')}
			</div>
			<div class="flap-back"></div>
		</div>

		<!-- The seal is the one control: pointer, keyboard and screen readers all open it here. -->
		<button type="button" class="seal" aria-label={envelope.open} onclick={open} bind:this={seal}>
			<img src="/images/envelope-seal.webp" alt="" width="160" height="160" />
			{@render wax('seal-wax')}
		</button>
	</div>

	<p class="hint eyebrow" aria-hidden="true" bind:this={hint}>{envelope.open}</p>
</div>

<style>
	.envelope {
		/*
		 * The photo is 735 by 490. Its layers are cut along the lace in percentages of that frame:
		 * the flap runs from the top corners down each side to a tip under the seal.
		 */
		--flap: polygon(0 0, 100% 0, 100% 28.57%, 50.2% 86.12%, 0 26.94%);
		--stage-w: min(135vw, 86svh * 1.5, 900px);
		/* All four photo edges melt into the backdrop, so the rectangle of the photo never shows. */
		--photo-fade:
			linear-gradient(transparent, black 16%, black 84%, transparent),
			linear-gradient(90deg, transparent, black 9%, black 91%, transparent);

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
		top: max(6svh, calc(50svh - var(--stage-w) / 3 - 9.5rem));
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

	/* «Алина Кыз Узату» runs 9.6 em wide: 9.2vw keeps it on one line with a margin on any phone. */
	.title {
		font-family: var(--font-script);
		font-size: clamp(1.8rem, 9.2vw, 4rem);
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
		aspect-ratio: 735 / 490;
		translate: -50% -50%;
	}

	/* The photo layers share one frame and one edge fade. */
	.inside,
	.body {
		position: absolute;
		inset: 0;
		mask: var(--photo-fade);
		mask-composite: intersect;
	}

	.inside {
		clip-path: var(--flap);
		background: radial-gradient(
			ellipse 60% 70% at 50% 20%,
			color-mix(in oklab, var(--c-accent-deep) 70%, black),
			color-mix(in oklab, var(--c-accent-deep) 40%, black)
		);
	}

	.body {
		z-index: 2;
		background: url('/images/envelope.webp') center / 100% 100%;
		/* Everything below the flap: the V cut out of the photo. */
		clip-path: polygon(0 26.94%, 50.2% 86.12%, 100% 28.57%, 100% 100%, 0 100%);
	}

	.flap {
		position: absolute;
		inset: 0;
		z-index: 3;
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
		mask: var(--photo-fade);
		mask-composite: intersect;
	}

	/* Seen once the flap has swung past upright: plain felt, darker than the lace side. */
	.flap-back {
		transform: rotateX(180deg);
		background: linear-gradient(
			color-mix(in oklab, var(--c-accent) 70%, black),
			color-mix(in oklab, var(--c-accent-deep) 80%, black)
		);
	}

	.seal {
		position: absolute;
		z-index: 4;
		top: 56.33%;
		left: 50.2%;
		width: 21.8%;
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
		filter: drop-shadow(0 8px 12px color-mix(in oklab, black 55%, transparent));
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
			inset: 6%;
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

	.wax {
		position: absolute;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: radial-gradient(circle at 42% 36%, #b8454e, #8f1f2c 38%, #6a0f1a 72%, #4f0a13);
		box-shadow:
			inset 0 2px 4px color-mix(in oklab, black 45%, transparent),
			inset 0 -2px 3px color-mix(in oklab, #f0c9a0 25%, transparent);
	}

	.seal-wax {
		inset: 21%;
	}

	/* The same disc on the flap, placed over the photo's own seal: 58% of the seal's 21.8% width. */
	.flap-wax {
		top: 56.33%;
		left: 50.2%;
		width: 12.64%;
		aspect-ratio: 1;
		translate: -50% -50%;
	}

	/* A thin roman capital, pressed into the wax like a signet. */
	.monogram {
		translate: 0 3%;
		font-family: var(--font-display);
		font-size: calc(var(--stage-w) * 0.085);
		font-weight: 300;
		line-height: 1;
		background: linear-gradient(160deg, #fbe7b0, var(--c-gold) 45%, #8a6424 80%);
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 1px 0 color-mix(in oklab, black 55%, transparent));
	}

	.hint {
		position: absolute;
		bottom: max(8svh, calc(50svh - var(--stage-w) / 3 - 5rem));
		left: 0;
		right: 0;
		z-index: 6;
		color: color-mix(in oklab, var(--c-gold) 60%, var(--c-ivory));
		text-align: center;
		text-shadow: 0 1px 10px color-mix(in oklab, black 45%, transparent);
		pointer-events: none;
	}
</style>
