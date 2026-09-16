<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { dateParts } from '$lib/content/event';
	import { Heading } from '$lib/ui';
	import Bouquet from './Bouquet.svelte';
	import { scallopedEllipse } from './ornaments';

	type Props = { cover: ContentData['cover']; date: string };

	let { cover, date }: Props = $props();

	const [day, month, year] = $derived(dateParts(date));
	const plate = scallopedEllipse(130, 55, 118, 44, 30, 7);
	const id = $props.id();
</script>

<header class="cover">
	<div class="composition">
		<Bouquet flowers={3} class="bouquet bouquet-back" />

		<div class="card">
			<div class="frame">
				<p class="eyebrow text-accent">{cover.eyebrow}</p>
				<div class="text-wine">
					<Heading level={1} script>{cover.title}</Heading>
				</div>
				<p class="max-w-[28ch]">{cover.text}</p>
			</div>
		</div>

		<figure class="oval">
			<!-- The first screen's largest image: fetched eagerly and first. -->
			<img
				src={cover.photo.src}
				alt={cover.photo.alt}
				width="600"
				height="800"
				fetchpriority="high"
				decoding="async"
			/>
		</figure>

		<div class="plate">
			<svg viewBox="0 0 260 110" aria-hidden="true">
				<defs>
					<radialGradient id="{id}-wine" cx="40%" cy="30%" r="80%">
						<stop offset="0" style:stop-color="color-mix(in oklab, var(--c-wine) 80%, white)" />
						<stop offset="1" style:stop-color="color-mix(in oklab, var(--c-wine) 75%, black)" />
					</radialGradient>
				</defs>
				<path d={plate} fill="url(#{id}-wine)" />
				<ellipse
					cx="130"
					cy="55"
					rx="104"
					ry="33"
					fill="none"
					stroke-opacity=".55"
					stroke-dasharray="1.5 3"
					style:stroke="var(--c-paper)"
				/>
			</svg>
			<time datetime={date}>{day} | {month} | {year}</time>
		</div>

		<div class="pocket" aria-hidden="true">
			<svg viewBox="0 0 440 150" preserveAspectRatio="none">
				<path class="pocket-body" d="M0 18 L220 70 L440 18 L440 150 L0 150 Z" />
				<path class="pocket-fold" d="M0 150 L220 62 L440 150" />
				<path class="pocket-edge" d="M0 18 L220 70 L440 18" />
			</svg>
		</div>

		<Bouquet flowers={5} class="bouquet bouquet-front" />
	</div>
</header>

<style>
	.cover {
		display: grid;
		justify-items: center;
		padding: 4.5rem 1.25rem 0;
		background: radial-gradient(ellipse 80% 60% at 50% 30%, var(--c-ivory), transparent 70%);
	}

	.composition {
		position: relative;
		display: grid;
		justify-items: center;
		width: min(100%, 440px);
		padding-bottom: 7rem;
	}

	.card {
		position: relative;
		z-index: 2;
		width: min(88%, 360px);
		border: 12px solid transparent;
		/* Striped paper border from the printed card, drawn without an image request. */
		background:
			linear-gradient(var(--c-ivory), var(--c-ivory)) padding-box,
			repeating-linear-gradient(90deg, var(--c-accent) 0 3px, var(--c-ivory) 3px 9px) border-box;
		box-shadow:
			0 18px 40px color-mix(in oklab, var(--c-accent-deep) 20%, transparent),
			0 2px 6px color-mix(in oklab, var(--c-accent-deep) 14%, transparent);
	}

	.frame {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2.25rem 1.25rem 4.5rem;
		border: 1px solid var(--c-accent);
		outline: 1px solid color-mix(in oklab, var(--c-accent) 35%, transparent);
		outline-offset: -6px;
		text-align: center;
	}

	.oval {
		position: absolute;
		z-index: 3;
		top: -2.5rem;
		left: -0.5rem;
		width: 32%;
		margin: 0;
		aspect-ratio: 3 / 4;
		padding: 7px;
		border-radius: 50%;
		background: var(--c-paper);
		box-shadow:
			0 10px 22px color-mix(in oklab, var(--c-accent-deep) 28%, transparent),
			inset 0 0 0 1px color-mix(in oklab, var(--c-muted) 35%, transparent);
		rotate: -6deg;
	}

	.oval img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.plate {
		position: absolute;
		z-index: 4;
		left: 50%;
		bottom: 5.25rem;
		width: min(64%, 250px);
		translate: -50% 0;
		filter: drop-shadow(0 8px 12px color-mix(in oklab, var(--c-wine) 30%, transparent));
	}

	.plate svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.plate time {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--c-ivory);
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 6vw, 1.75rem);
		font-variant-numeric: lining-nums tabular-nums;
		letter-spacing: 0.04em;
	}

	.pocket {
		position: absolute;
		z-index: 3;
		inset: auto 0 0;
		height: 9.5rem;
	}

	.pocket svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.pocket-body {
		fill: var(--c-accent);
	}

	.pocket-fold {
		fill: none;
		stroke: var(--c-ivory);
		stroke-opacity: 0.25;
		stroke-width: 1.2;
		vector-effect: non-scaling-stroke;
	}

	.pocket-edge {
		fill: none;
		stroke: var(--c-accent-deep);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	.composition :global(.bouquet) {
		position: absolute;
		pointer-events: none;
	}

	.composition :global(.bouquet-front) {
		z-index: 5;
		right: -0.75rem;
		bottom: 2rem;
		width: 42%;
	}

	.composition :global(.bouquet-back) {
		z-index: 1;
		top: 45%;
		left: -1.5rem;
		width: 26%;
		rotate: 160deg;
	}

	@media (min-width: 720px) {
		.cover {
			padding-top: 6rem;
		}

		.composition {
			width: 560px;
		}

		.oval {
			top: 1rem;
			left: -3rem;
			width: 34%;
		}

		.composition :global(.bouquet-front) {
			right: -3.5rem;
			width: 36%;
		}
	}
</style>
