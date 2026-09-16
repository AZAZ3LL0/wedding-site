<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { dateParts } from '$lib/content/event';
	import { ScriptText } from '$lib/ui';

	type Props = {
		cover: ContentData['cover'];
		event: Pick<ContentData['event'], 'date' | 'time'>;
		venue: Pick<ContentData['venue'], 'title' | 'address'>;
		hosts: string;
	};

	let { cover, event, venue, hosts }: Props = $props();

	const [day, month, year] = $derived(dateParts(event.date));
</script>

<header class="scene">
	<article class="card" data-card>
		<div class="panel">
			<h1 class="title">
				<ScriptText text={cover.title} />
				<span class="title-line"><ScriptText text={cover.eyebrow} /></span>
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

			<p class="hosts"><ScriptText text={hosts} /></p>
		</div>

		<!-- The printed card's own flowers, cut out of it so they can grow in when the envelope opens.
		     Backgrounds rather than images, so the stylesheet decides when they are fetched. -->
		<div class="flower flower-top" aria-hidden="true"></div>
		<div class="flower flower-bottom" aria-hidden="true"></div>
	</article>
</header>

<style>
	.scene {
		display: grid;
		justify-items: center;
		padding: 3rem 1.25rem 2.5rem;
		overflow-x: clip;
		background: radial-gradient(ellipse 90% 60% at 50% 35%, var(--c-ivory), transparent 75%);
	}

	/*
	 * The lace frame is the printed card itself, 722 by 1280, with its panel cut out and its flowers
	 * lifted off. Its slices sit on the panel edges, so the frame keeps its proportions at any width
	 * while the panel grows with the text.
	 */
	.card {
		--w: min(100vw - 2.5rem, 440px);

		position: relative;
		width: var(--w);
		border-style: solid;
		border-width: calc(var(--w) * 0.2) calc(var(--w) * 0.144) calc(var(--w) * 0.186);
		border-image: url('/images/card-frame.webp') 144 104 134 104 / auto / 0 stretch;
		box-shadow:
			0 24px 50px color-mix(in oklab, var(--c-accent-deep) 22%, transparent),
			0 3px 8px color-mix(in oklab, var(--c-accent-deep) 14%, transparent);
	}

	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(0.85rem, 3.6vw, 1.25rem);
		padding: clamp(1.5rem, 7vw, 2.25rem) clamp(0.25rem, 2vw, 1rem) clamp(3rem, 14vw, 4.25rem);
		color: var(--c-accent);
		text-align: center;
		/* The paper of the printed panel: warm cream, a shade lighter towards the top. */
		background: radial-gradient(ellipse 90% 60% at 50% 25%, #f6f1ec, #efe6de);
	}

	/* «Кыз Узату!» runs about 5 em wide, so the size tracks the panel and each line stays whole. */
	.title {
		display: flex;
		flex-direction: column;
		font-family: var(--font-script);
		font-size: calc(var(--w) * 0.132);
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

	.when {
		display: flex;
		flex-direction: column;
		font-family: var(--font-display);
		font-size: clamp(1.9rem, 8.6vw, 2.4rem);
		line-height: 1.1;
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

	/* Sized to the panel like the title, so the signature stays clear of the bottom flowers. */
	.hosts {
		font-family: var(--font-script);
		font-size: calc(var(--w) * 0.076);
		line-height: 1.1;
		white-space: nowrap;
	}

	/* Anchored to the corners they grow from on the printed card; sizes are shares of its width. */
	.flower {
		position: absolute;
		z-index: 1;
		background: center / contain no-repeat;
		pointer-events: none;
	}

	.flower-top {
		top: calc(var(--w) * -0.2);
		right: calc(var(--w) * -0.144);
		width: calc(var(--w) * 0.4224);
		aspect-ratio: 305 / 330;
		background-image: url('/images/card-flower-top.webp');
		transform-origin: 100% 0;
	}

	.flower-bottom {
		bottom: calc(var(--w) * -0.186);
		left: calc(var(--w) * -0.144);
		width: calc(var(--w) * 0.4432);
		aspect-ratio: 320 / 439;
		background-image: url('/images/card-flower-bottom.webp');
		transform-origin: 0 100%;
	}

	/*
	 * Under a closed envelope the frame and flowers are not fetched until the envelope is on screen
	 * (see ENVELOPE_ART). Without JS, on a return visit or with reduced motion this never matches.
	 */
	/* The longhand on purpose: the CSS minifier empties a `border-image: none` shorthand. */
	:global(html.js:not(.envelope-opened):not(.envelope-art)) .card {
		border-image-source: none;
		border-color: transparent;
	}

	:global(html.js:not(.envelope-opened):not(.envelope-art)) .flower {
		background-image: none;
	}

	/* Flowers grow in as the envelope opens. Already open, no JS or reduced motion: they are there. */
	@media (prefers-reduced-motion: no-preference) {
		.flower {
			transition:
				opacity 1.2s var(--ease-out) var(--bloom-delay, 150ms),
				scale 1.6s var(--ease-out) var(--bloom-delay, 150ms),
				rotate 1.6s var(--ease-out) var(--bloom-delay, 150ms);
		}

		.flower-bottom {
			--bloom-delay: 450ms;
		}

		:global(html.js:not(.envelope-opened)) .flower {
			opacity: 0;
			scale: 0.5;
			rotate: -12deg;
		}
	}
</style>
