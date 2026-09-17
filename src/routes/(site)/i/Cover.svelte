<script lang="ts">
	import type { ContentData } from '$lib/content/schema';
	import { dateParts, monthName } from '$lib/content/event';

	type Props = {
		cover: ContentData['cover'];
		event: Pick<ContentData['event'], 'date' | 'time'>;
		months: ContentData['ui']['months'];
	};

	let { cover, event, months }: Props = $props();

	const [day, , year] = $derived(dateParts(event.date));
	const month = $derived(monthName(event.date, months));
</script>

<header class="scene">
	<h1 class="title">
		{cover.title}
		<span class="title-line">{cover.eyebrow}</span>
	</h1>

	<!-- The arch of the printed invitation: tooled velvet ending in lace, the date in gold on it. -->
	<section class="arch" data-card>
		<div class="cloth" aria-hidden="true"></div>

		<!-- Damask pressed into the cloth, a shade lighter than the velvet itself. -->
		<svg class="emboss" viewBox="0 0 240 40" fill="none" aria-hidden="true">
			<path
				d="M120 6c-9 0-15 7-15 14s6 14 15 14 15-7 15-14-6-14-15-14Zm0 5c6 0 10 4 10 9s-4 9-10 9-10-4-10-9 4-9 10-9Z"
				fill="currentColor"
			/>
			<path
				d="M105 20c-10-11-22-14-33-8-8 5-11 13-8 20 6-10 16-14 26-9-8 1-13 5-15 11 9-4 19-5 30-14Zm30 0c10-11 22-14 33-8 8 5 11 13 8 20-6-10-16-14-26-9 8 1 13 5 15 11-9-4-19-5-30-14Z"
				fill="currentColor"
			/>
			<path d="M2 20h60M178 20h60" stroke="currentColor" stroke-width="1.2" />
		</svg>

		<p class="when">
			<time datetime={event.date}>
				<span class="figure">{day}</span>
				<span class="month">{month}</span>
				<span class="figure">{year}</span>
			</time>
			<span class="at">{event.time}</span>
		</p>

		<p class="text">{cover.text}</p>
	</section>
</header>

<style>
	.scene {
		/* Viewport units, so the value is the same wherever it is substituted. */
		--w: min(100vw - 2.5rem, 30rem);

		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(1.5rem, 6vw, 2.5rem);
		padding-top: clamp(3rem, 12vw, 5rem);
		background: var(--c-paper);
	}

	/* «Кыз Узату!» runs 6.3 em wide, so the size follows the screen and each line stays whole. */
	.title {
		display: flex;
		flex-direction: column;
		font-family: var(--font-script);
		font-size: min(3.25rem, 13vw);
		font-weight: 400;
		line-height: 1.05;
		color: var(--c-accent);
		text-align: center;
		white-space: nowrap;
	}

	.title-line {
		margin-top: 0.05em;
	}

	/*
	 * A half-round top on a block that runs off the bottom of the screen, so the arch reads as cloth
	 * hung behind the date rather than as a card.
	 */
	.arch {
		--lace: calc(var(--w) * 0.676); /* the lace photo is 410 by 277 */

		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(1.25rem, 5vw, 1.75rem);
		width: var(--w);
		min-height: min(78svh, 34rem);
		padding: clamp(2.5rem, 10vw, 4rem) clamp(1.5rem, 7vw, 3rem) calc(var(--lace) * 0.98);
		color: var(--c-gold);
		text-align: center;
	}

	/*
	 * The cloth carries the velvet and the shape, so the lace mask never cuts into the text. Two mask
	 * layers add up: the photo's own alpha along the bottom, and a plain block over everything above it.
	 */
	.cloth {
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: 50% 50% 0 0 / 28% 28% 0 0;
		background:
			radial-gradient(
				ellipse 80% 45% at 50% 0%,
				color-mix(in oklab, var(--c-accent) 35%, transparent),
				transparent
			),
			url('/images/velvet.jpg') center / cover var(--c-accent-deep);
		mask-image: url('/images/lace-mask.png'), linear-gradient(#000, #000);
		mask-size:
			100% auto,
			/* 2px of overlap: without it the two layers leave a hairline across the cloth. */ 100%
				calc(100% - var(--lace) + 2px);
		mask-position:
			bottom center,
			top center;
		mask-repeat: no-repeat, no-repeat;
	}

	/*
	 * Under a closed envelope the velvet and the lace are not fetched until the envelope is on screen
	 * (see ENVELOPE_ART). Without JS, on a return visit or with reduced motion this never matches.
	 * Longhands on purpose: the CSS minifier empties a `background: none` shorthand.
	 */
	:global(html.js:not(.envelope-opened):not(.envelope-art)) .cloth {
		background-image: none;
		mask-image: none;
	}

	.emboss {
		width: clamp(9rem, 45%, 13rem);
		/* Barely lighter than the cloth: a pressed pattern, not an applied ornament. */
		color: color-mix(in oklab, var(--c-gold) 18%, transparent);
	}

	.when {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1em;
		margin-top: auto;
	}

	.when time {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}

	.figure {
		font-family: var(--font-display);
		font-size: min(4.5rem, 19vw);
		font-weight: 300;
		font-variant-numeric: lining-nums tabular-nums;
	}

	/* Lighter and closer to the day than the figures, as on the printed card. */
	.month {
		margin: -0.06em 0 -0.02em;
		font-family: var(--font-script);
		font-size: min(3.25rem, 14vw);
		line-height: 1.05;
	}

	.at {
		margin-top: 0.7rem;
		font-family: var(--font-display);
		font-size: min(1.75rem, 7vw);
		letter-spacing: 0.08em;
		color: color-mix(in oklab, var(--c-gold) 85%, transparent);
		font-variant-numeric: lining-nums tabular-nums;
	}

	.text {
		max-width: 30ch;
		margin-top: auto;
		font-size: clamp(1rem, 4.2vw, 1.125rem);
		line-height: 1.45;
		/* Lifted towards the cream: gold this small reads poorly on the dark velvet. */
		color: color-mix(in oklab, var(--c-gold) 55%, var(--c-ivory));
	}

	/* As the envelope fades the arch rises into place; after that, it just is. */
	@media (prefers-reduced-motion: no-preference) {
		.arch {
			transition:
				translate 1.5s var(--ease-out),
				scale 1.5s var(--ease-out);
		}

		:global(html.js:not(.envelope-opened):not(.envelope-leaving)) .arch {
			translate: 0 24svh;
			scale: 0.88;
		}
	}
</style>
