<script lang="ts">
	import { onMount } from 'svelte';
	import type { ContentData } from '$lib/content/schema';
	import { dateParts } from '$lib/content/event';

	type Props = {
		cover: ContentData['cover'];
		event: Pick<ContentData['event'], 'date' | 'time'>;
		venue: Pick<ContentData['venue'], 'title' | 'address'>;
		hosts: string;
	};

	let { cover, event, venue, hosts }: Props = $props();

	const [day, month, year] = $derived(dateParts(event.date));

	let scene: HTMLElement;

	/*
	 * Depth: the card and the roses tilt and drift at different rates, so the roses read as lying
	 * above the card. A mouse leads on a laptop; on a phone the scroll position does. Values ease
	 * towards their target each frame, so the motion stays soft.
	 */
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const pointer = matchMedia('(pointer: fine)').matches;
		let target = { x: 0, y: 0 };
		let current = { x: 0, y: 0 };
		let frame = 0;

		const tick = () => {
			current = {
				x: current.x + (target.x - current.x) * 0.08,
				y: current.y + (target.y - current.y) * 0.08
			};
			scene.style.setProperty('--tilt-x', current.x.toFixed(3));
			scene.style.setProperty('--tilt-y', current.y.toFixed(3));
			const settled =
				Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
			frame = settled ? 0 : requestAnimationFrame(tick);
		};
		const aim = (x: number, y: number) => {
			target = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
			frame ||= requestAnimationFrame(tick);
		};

		const onPointer = (e: PointerEvent) =>
			aim((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
		const onScroll = () => {
			const box = scene.getBoundingClientRect();
			aim(0, (box.top + box.height / 2 - innerHeight / 2) / innerHeight);
		};

		if (pointer) addEventListener('pointermove', onPointer, { passive: true });
		else addEventListener('scroll', onScroll, { passive: true });
		return () => {
			removeEventListener('pointermove', onPointer);
			removeEventListener('scroll', onScroll);
			cancelAnimationFrame(frame);
		};
	});
</script>

<header class="scene" bind:this={scene}>
	<div class="depth">
		<article class="card" data-card>
			<div class="panel">
				<h1 class="title">
					{cover.title}
					<span class="title-line">{cover.eyebrow}</span>
				</h1>

				<p class="text">{cover.text}</p>

				<p class="when">
					<time datetime={event.date}>{day} | {month} | {year}</time>
					<time datetime="{event.date}T{event.time}">{event.time}</time>
				</p>

				<p class="where">
					<span>{venue.address}</span>
					<span class="venue">{venue.title}</span>
				</p>

				<p class="hosts">{hosts}</p>
			</div>
		</article>

		<!-- Whole roses rather than the card's own cosmos, which the printed card cuts off at its
		     edges. Backgrounds, so the stylesheet decides when they are fetched. -->
		<div class="rose rose-top" aria-hidden="true"></div>
		<div class="rose rose-bottom" aria-hidden="true"></div>
	</div>
</header>

<style>
	/* The card lies on the velvet of the envelope it came out of, which melts into the cream below. */
	.scene {
		--tilt-x: 0;
		--tilt-y: 0;

		position: relative;
		isolation: isolate;
		display: grid;
		justify-items: center;
		padding: clamp(4.5rem, 16vw, 7rem) 1rem clamp(6rem, 22vw, 9rem);
		overflow-x: clip;
	}

	.scene::before {
		content: '';
		position: absolute;
		inset: -3rem;
		z-index: -2;
		background: url('/images/envelope.webp') center / cover;
		filter: blur(26px) brightness(0.62) saturate(1.1);
	}

	.scene::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(
				ellipse 70% 55% at 50% 42%,
				transparent,
				color-mix(in oklab, var(--c-accent-deep) 55%, black)
			),
			linear-gradient(transparent 78%, var(--c-paper));
	}

	.depth {
		position: relative;
		perspective: 1400px;
	}

	/*
	 * The lace frame is the printed card itself, 722 by 1280, with its panel cut out and its flowers
	 * lifted off. Its slices sit on the panel edges, so the frame keeps its proportions at any width
	 * while the panel grows with the text.
	 */
	.card {
		--w: min(100vw - 5.5rem, 420px);

		position: relative;
		width: var(--w);
		border-style: solid;
		border-width: calc(var(--w) * 0.2) calc(var(--w) * 0.144) calc(var(--w) * 0.186);
		border-image: url('/images/card-frame.webp') 144 104 134 104 / auto / 0 stretch;
		transform: rotateX(calc(var(--tilt-y) * -3deg)) rotateY(calc(var(--tilt-x) * 4deg));
		box-shadow:
			0 40px 70px color-mix(in oklab, black 50%, transparent),
			0 12px 24px color-mix(in oklab, black 35%, transparent);
	}

	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(0.85rem, 3.6vw, 1.25rem);
		padding: clamp(1.5rem, 7vw, 2.25rem) clamp(0.25rem, 2vw, 1rem) clamp(1.75rem, 8vw, 2.5rem);
		color: var(--c-accent);
		text-align: center;
		/* The paper of the printed panel: warm cream, a shade lighter towards the top. */
		background: radial-gradient(ellipse 90% 60% at 50% 25%, #f6f1ec, #efe6de);
	}

	/* «Кыз Узату!» runs 6.3 em wide, so the size tracks the panel and each line stays whole. */
	.title {
		display: flex;
		flex-direction: column;
		font-family: var(--font-script);
		font-size: calc(var(--w) * 0.106);
		font-weight: 400;
		line-height: 1.05;
		white-space: nowrap;
	}

	.title-line {
		margin-top: 0.05em;
	}

	.text {
		max-width: 32ch;
		font-size: clamp(0.98rem, 4.1vw, 1.18rem);
		line-height: 1.4;
		color: color-mix(in oklab, var(--c-accent) 88%, var(--c-ink));
	}

	/* Sized to the panel like the title, so the date stays on one line on a 320 px phone. */
	.when {
		display: flex;
		flex-direction: column;
		font-family: var(--font-display);
		font-size: min(2.4rem, calc(var(--w) * 0.12));
		line-height: 1.1;
		white-space: nowrap;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.where {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-width: 24ch;
		font-size: clamp(1.02rem, 4.3vw, 1.22rem);
		line-height: 1.3;
	}

	/* Sized to the panel like the title, so the signature stays clear of the roses. */
	.hosts {
		font-family: var(--font-script);
		font-size: calc(var(--w) * 0.072);
		line-height: 1.1;
		white-space: nowrap;
	}

	/*
	 * The cut-out blooms along its top and left edges; each corner mirrors it into place. The roses
	 * reach past the card and cast a deeper shadow than it does, and they drift with the tilt, which is
	 * what makes them read as lying above it. They reach 12% of the card width past its edge, which
	 * the side margin always holds, so the screen never cuts them off.
	 */
	.rose {
		--w: min(100vw - 5.5rem, 420px);

		position: absolute;
		z-index: 1;
		width: calc(var(--w) * 0.72);
		aspect-ratio: 406 / 418;
		background: url('/images/roses.webp') center / contain no-repeat;
		filter: drop-shadow(0 22px 26px color-mix(in oklab, black 55%, transparent))
			drop-shadow(0 6px 8px color-mix(in oklab, black 35%, transparent));
		translate: calc(var(--tilt-x) * 10px) calc(var(--tilt-y) * 12px);
		pointer-events: none;
	}

	.rose-top {
		top: calc(var(--w) * -0.16);
		right: calc(var(--w) * -0.12);
		/* Mirrored about its own centre: an off-centre origin would push it out of place. */
		transform: scaleX(-1);
	}

	.rose-bottom {
		bottom: calc(var(--w) * -0.16);
		left: calc(var(--w) * -0.12);
		transform: scaleY(-1);
	}

	/*
	 * Under a closed envelope the frame and roses are not fetched until the envelope is on screen
	 * (see ENVELOPE_ART). Without JS, on a return visit or with reduced motion this never matches.
	 * The longhand on purpose: the CSS minifier empties a `border-image: none` shorthand.
	 */
	:global(html.js:not(.envelope-opened):not(.envelope-art)) .card {
		border-image-source: none;
		border-color: transparent;
	}

	:global(html.js:not(.envelope-opened):not(.envelope-art)) .rose {
		background-image: none;
	}

	/* As the envelope fades the card rises out of it and the roses bloom; after that, they just are. */
	@media (prefers-reduced-motion: no-preference) {
		.card {
			transition:
				translate 1.5s var(--ease-out),
				scale 1.5s var(--ease-out),
				transform 0.2s linear;
		}

		.rose {
			transition:
				opacity 1.1s var(--ease-out) var(--bloom-delay, 700ms),
				scale 1.6s var(--ease-out) var(--bloom-delay, 700ms),
				rotate 1.6s var(--ease-out) var(--bloom-delay, 700ms);
		}

		.rose-bottom {
			--bloom-delay: 950ms;
		}

		:global(html.js:not(.envelope-opened):not(.envelope-leaving)) .card {
			translate: 0 24svh;
			scale: 0.88;
		}

		:global(html.js:not(.envelope-opened):not(.envelope-leaving)) .rose {
			opacity: 0;
			scale: 0.4;
			rotate: -16deg;
		}
	}
</style>
