<script lang="ts">
	import { animate } from 'motion/mini';
	import { onMount } from 'svelte';
	import { motionTokens } from '$lib/actions/motion-tokens';
	import type { ContentData } from '$lib/content/schema';
	import { ENVELOPE_OPENED, openingPlan, rememberOpened } from './envelope';
	import { scallopedEllipse } from './ornaments';

	type Props = {
		envelope: ContentData['envelope'];
		// Reports whether the envelope covers the page, so the page can make itself inert.
		oncover?: (covering: boolean) => void;
		onopen?: () => void;
	};

	let { envelope, oncover, onopen }: Props = $props();

	const id = $props.id();
	const ring = scallopedEllipse(50, 62.5, 40, 52, 28, 3.6);

	let root: HTMLElement;
	let seal: HTMLElement;
	let text: HTMLElement;
	let button: HTMLElement;
	let flap: HTMLElement;
	let card: HTMLElement;
	let opening = false;

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
		const fadeOut = { opacity: [1, 0] };
		const rise = card.offsetTop - window.innerHeight * 0.08;

		animate(seal, { opacity: [1, 0], scale: [1, 0.7] }, { ...plan.seal, ease: 'easeIn' });
		animate([text, button], fadeOut, plan.seal);
		animate(
			flap,
			{ transform: ['perspective(1600px) rotateX(0deg)', 'perspective(1600px) rotateX(-178deg)'] },
			{ ...plan.flap, ease: [0.55, 0, 0.3, 1] }
		);
		animate(
			card,
			{ transform: ['translateY(0)', `translateY(${-rise}px)`] },
			{ ...plan.card, ease }
		);
		await animate(root, fadeOut, { ...plan.fade, ease: 'easeOut' }).finished.catch(() => undefined);
		finish();
	}
</script>

<div class="envelope" role="dialog" aria-modal="true" aria-labelledby="{id}-title" bind:this={root}>
	<div class="inside" aria-hidden="true"></div>

	<div class="card" aria-hidden="true" bind:this={card}>
		<div class="card-frame">
			<span class="card-title">{envelope.title}</span>
		</div>
	</div>

	<div class="pocket" aria-hidden="true">
		<div class="pocket-sides"></div>
		<div class="pocket-bottom"></div>
	</div>

	<div class="flap" aria-hidden="true" bind:this={flap}>
		<div class="flap-body"></div>
		<svg class="lace lace-left">
			<defs>
				<pattern id="{id}-lace" width="26" height="36" patternUnits="userSpaceOnUse">
					<rect class="lace-thread" width="26" height="11" />
					<rect class="lace-hole" y="1.5" width="26" height="0.8" opacity=".4" />
					<path class="lace-thread" d="M0 10A13 15 0 0 0 26 10Z" />
					<path class="lace-stitch" d="M4.5 12A8.5 10 0 0 0 21.5 12" />
					<circle class="lace-hole" cx="6.5" cy="6" r="1.5" />
					<circle class="lace-hole" cx="19.5" cy="6" r="1.5" />
					<circle class="lace-hole" cx="13" cy="6" r=".9" />
					<circle class="lace-hole" cx="13" cy="18" r="2.4" />
					<circle class="lace-hole" cx="8" cy="14.5" r="1" />
					<circle class="lace-hole" cx="18" cy="14.5" r="1" />
					<circle class="lace-thread" cx="2.2" cy="18.5" r="1.4" />
					<circle class="lace-thread" cx="7" cy="23.5" r="1.4" />
					<circle class="lace-thread" cx="13" cy="25.6" r="1.4" />
					<circle class="lace-thread" cx="19" cy="23.5" r="1.4" />
					<circle class="lace-thread" cx="23.8" cy="18.5" r="1.4" />
				</pattern>
			</defs>
			<rect width="100%" height="36" fill="url(#{id}-lace)" />
		</svg>
		<svg class="lace lace-right">
			<rect width="100%" height="36" fill="url(#{id}-lace)" />
		</svg>
	</div>

	<div class="text" bind:this={text}>
		<p class="eyebrow">{envelope.eyebrow}</p>
		<p class="title" id="{id}-title">{envelope.title}</p>
	</div>

	<!-- A pointer target only: keyboard and screen reader users get the labelled button below. -->
	<button
		type="button"
		class="seal"
		tabindex="-1"
		aria-hidden="true"
		onclick={open}
		bind:this={seal}
	>
		<svg viewBox="0 0 100 125">
			<path class="seal-ring" d={ring} />
			<path class="seal-ring-shadow" d={ring} transform="translate(.7 .9)" />
			<ellipse class="seal-inner" cx="50" cy="62.5" rx="33" ry="45" />
		</svg>
		<span class="monogram">{envelope.monogram}</span>
	</button>

	<button type="button" class="open eyebrow" onclick={open} bind:this={button}>
		{envelope.open}
	</button>
</div>

<style>
	.envelope {
		/* Where the flap tip meets the pocket; everything else is placed from this line. */
		--apex: 52svh;
		--lace-angle: atan2(var(--apex), 50vw);

		position: fixed;
		inset: 0;
		z-index: 50;
		display: none;
		overflow: hidden;
		background: var(--c-olive-deep);
	}

	@media (orientation: landscape) {
		.envelope {
			--apex: 60svh;
		}
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

	/* Velvet pile: a tiny noise tile blended over every olive surface. */
	.envelope::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 6;
		pointer-events: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .4 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E");
		mix-blend-mode: overlay;
		opacity: 0.5;
	}

	.inside {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at 50% 35%,
			color-mix(in oklab, var(--c-olive-deep) 85%, var(--c-olive)),
			color-mix(in oklab, var(--c-olive-deep) 75%, black)
		);
	}

	.card {
		position: absolute;
		z-index: 1;
		top: calc(var(--apex) * 0.72);
		left: 50%;
		width: min(78vw, 360px);
		aspect-ratio: 5 / 7;
		translate: -50% 0;
		border: 12px solid transparent;
		background:
			linear-gradient(var(--c-ivory), var(--c-ivory)) padding-box,
			repeating-linear-gradient(90deg, var(--c-olive) 0 3px, var(--c-ivory) 3px 9px) border-box;
	}

	.card-frame {
		display: flex;
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--c-olive);
		color: var(--c-wine);
		text-align: center;
	}

	.card-title {
		font-family: var(--font-script);
		font-size: clamp(3rem, 14vw, 4.25rem);
		line-height: 1;
	}

	.pocket {
		position: absolute;
		inset: 0;
		z-index: 2;
	}

	.pocket-sides {
		position: absolute;
		inset: 0;
		clip-path: polygon(0 5%, 50% calc(var(--apex) + 8px), 100% 5%, 100% 100%, 0 100%);
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--c-olive) 88%, black),
			var(--c-olive) 50%,
			color-mix(in oklab, var(--c-olive) 85%, black)
		);
	}

	.pocket-bottom {
		position: absolute;
		inset: 0;
		clip-path: polygon(0 100%, 50% calc(var(--apex) + 7svh), 100% 100%);
		background: linear-gradient(
			color-mix(in oklab, var(--c-olive) 90%, var(--c-ivory)),
			color-mix(in oklab, var(--c-olive) 88%, black)
		);
	}

	.flap {
		position: absolute;
		inset: 0;
		z-index: 3;
		transform-origin: 50% 0;
		filter: drop-shadow(0 14px 18px color-mix(in oklab, black 45%, transparent));
	}

	.flap-body {
		position: absolute;
		inset: 0;
		clip-path: polygon(0 0, 100% 0, 50% var(--apex));
		background: linear-gradient(
			color-mix(in oklab, var(--c-olive) 95%, black),
			color-mix(in oklab, var(--c-olive) 92%, var(--c-ivory)) var(--apex)
		);
	}

	/* Lace runs along both flap edges and stops at the tip, whatever the screen proportions. */
	.lace {
		position: absolute;
		top: -5px;
		width: calc(50vw / cos(var(--lace-angle)) + 14px);
		height: 36px;
		overflow: visible;
		filter: drop-shadow(0 3px 2.5px color-mix(in oklab, black 55%, transparent));
	}

	.lace-left {
		left: -14px;
		transform-origin: 14px 5px;
		rotate: var(--lace-angle);
	}

	.lace-right {
		right: -14px;
		transform-origin: calc(100% - 14px) 5px;
		rotate: calc(-1 * var(--lace-angle));
	}

	.lace-thread {
		fill: color-mix(in oklab, var(--c-olive) 85%, var(--c-ivory));
	}

	.lace-hole {
		fill: var(--c-olive-deep);
	}

	.lace-stitch {
		fill: none;
		stroke: var(--c-olive-deep);
		stroke-width: 1.1;
	}

	.text {
		position: absolute;
		z-index: 4;
		top: calc(var(--apex) * 0.42);
		right: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		translate: 0 -50%;
		color: var(--c-ivory);
		text-align: center;
		text-shadow: 0 1px 12px color-mix(in oklab, black 35%, transparent);
		pointer-events: none;
	}

	.text .eyebrow,
	.open {
		color: var(--c-ivory);
	}

	.title {
		font-family: var(--font-script);
		font-size: clamp(3.5rem, 15vw, 5.5rem);
		line-height: 1.05;
	}

	.seal {
		position: absolute;
		z-index: 5;
		top: var(--apex);
		left: 50%;
		display: grid;
		width: clamp(92px, 24vw, 132px);
		aspect-ratio: 4 / 5;
		place-items: center;
		translate: -50% -50%;
		border-radius: 50%;
		cursor: pointer;
		background: radial-gradient(
			ellipse at 36% 28%,
			white,
			var(--c-ivory) 25%,
			var(--c-paper) 55%,
			color-mix(in oklab, var(--c-paper) 85%, var(--c-muted))
		);
		box-shadow:
			0 12px 22px color-mix(in oklab, black 50%, transparent),
			0 2px 3px color-mix(in oklab, black 35%, transparent),
			inset -5px -8px 12px color-mix(in oklab, var(--c-muted) 30%, transparent),
			inset 5px 6px 10px color-mix(in oklab, white 85%, transparent);
		transition: scale var(--dur-fast) var(--ease-out);
	}

	.seal:hover {
		scale: 1.04;
	}

	.seal svg {
		position: absolute;
		inset: 9%;
		width: 82%;
		height: 82%;
	}

	.seal-ring {
		fill: none;
		stroke: white;
		stroke-width: 1.6;
	}

	.seal-ring-shadow {
		fill: none;
		stroke: var(--c-muted);
		stroke-opacity: 0.5;
		stroke-width: 1;
	}

	.seal-inner {
		fill: none;
		stroke: color-mix(in oklab, var(--c-paper) 70%, var(--c-muted));
		stroke-width: 0.7;
	}

	/* Embossed: the letter is the seal's own colour, lit from the top left. */
	.monogram {
		position: relative;
		translate: 0 4%;
		font-family: var(--font-script);
		font-size: clamp(2.6rem, 9vw, 3.6rem);
		line-height: 1;
		color: var(--c-paper);
		text-shadow:
			-1px -1px 0 white,
			1.5px 1.5px 1.5px color-mix(in oklab, var(--c-muted) 70%, transparent);
	}

	.open {
		position: absolute;
		z-index: 5;
		top: calc(var(--apex) + (100svh - var(--apex)) * 0.52);
		left: 50%;
		padding: 0.75rem 1rem;
		translate: -50% 0;
		white-space: nowrap;
		cursor: pointer;
		text-shadow: 0 1px 10px color-mix(in oklab, black 40%, transparent);
	}

	.open::after {
		content: '';
		display: block;
		height: 1px;
		margin-top: 0.4rem;
		background: currentColor;
		opacity: 0.5;
		transform: scaleX(0.3);
		transition: transform var(--dur-slow) var(--ease-out);
	}

	.open:hover::after,
	.open:focus-visible::after {
		transform: scaleX(1);
	}

	.open:focus-visible {
		outline: 2px solid var(--c-ivory);
		outline-offset: 2px;
	}
</style>
