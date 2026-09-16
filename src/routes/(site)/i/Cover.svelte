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

		<!-- One cut-out corner of roses, mirrored into the two corners of the printed card. -->
		<img
			class="rose rose-top"
			src="/images/roses.webp"
			alt=""
			width="406"
			height="418"
			decoding="async"
		/>
		<img
			class="rose rose-bottom"
			src="/images/roses.webp"
			alt=""
			width="406"
			height="418"
			decoding="async"
		/>
	</article>
</header>

<style>
	.scene {
		display: grid;
		justify-items: center;
		padding: 3.5rem 1.25rem 2.5rem;
		overflow-x: clip;
		background: radial-gradient(ellipse 90% 60% at 50% 35%, var(--c-ivory), transparent 75%);
	}

	.card {
		position: relative;
		width: min(100%, 440px);
		padding: clamp(18px, 5.5vw, 26px);
		/* Embossed lace: cream on cream, lit from the top left, drawn without an image request. */
		background:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' fill='none'%3E%3Cg stroke='%23fffdf9' stroke-width='1.1' stroke-linecap='round'%3E%3Cpath d='M4 22c6-8 12-8 18 0s12 8 18 0'/%3E%3Ccircle cx='22' cy='22' r='3.2'/%3E%3Cpath d='M22 4c-4 5-4 9 0 13M22 40c4-5 4-9 0-13'/%3E%3C/g%3E%3Cg stroke='%23d9c8b9' stroke-width='.9' stroke-linecap='round' transform='translate(.7 .8)'%3E%3Cpath d='M4 22c6-8 12-8 18 0s12 8 18 0'/%3E%3Ccircle cx='22' cy='22' r='3.2'/%3E%3Cpath d='M22 4c-4 5-4 9 0 13M22 40c4-5 4-9 0-13'/%3E%3C/g%3E%3Cg fill='%23e3d4c6'%3E%3Ccircle cx='4' cy='4' r='1.6'/%3E%3Ccircle cx='40' cy='4' r='1.6'/%3E%3Ccircle cx='4' cy='40' r='1.6'/%3E%3Ccircle cx='40' cy='40' r='1.6'/%3E%3C/g%3E%3C/svg%3E"),
			linear-gradient(145deg, #f6efe8, #ecdfd3);
		box-shadow:
			0 24px 50px color-mix(in oklab, var(--c-accent-deep) 22%, transparent),
			0 3px 8px color-mix(in oklab, var(--c-accent-deep) 14%, transparent);
	}

	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(1.1rem, 4.5vw, 1.6rem);
		padding: clamp(2.5rem, 11vw, 3.5rem) clamp(1rem, 5vw, 2rem);
		border: 3px dotted color-mix(in oklab, var(--c-paper) 70%, var(--c-muted));
		outline: 1px solid color-mix(in oklab, var(--c-paper) 55%, var(--c-muted));
		outline-offset: 5px;
		color: var(--c-accent);
		text-align: center;
		background: radial-gradient(ellipse at 50% 30%, var(--c-ivory), var(--c-paper));
	}

	/* «Кыз Узату!» runs about 5 em wide, so the size tracks the panel and each line stays whole. */
	.title {
		display: flex;
		flex-direction: column;
		font-family: var(--font-script);
		font-size: clamp(2.4rem, 12.5vw, 3.9rem);
		font-weight: 400;
		line-height: 1.05;
		white-space: nowrap;
	}

	.title-line {
		margin-top: 0.05em;
	}

	.text {
		max-width: 30ch;
		font-size: clamp(1.1rem, 4.6vw, 1.3rem);
		line-height: 1.45;
		color: color-mix(in oklab, var(--c-accent) 88%, var(--c-ink));
	}

	.when {
		display: flex;
		flex-direction: column;
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 10vw, 2.75rem);
		line-height: 1.1;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.where {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		max-width: 22ch;
		font-size: clamp(1.15rem, 4.8vw, 1.35rem);
		line-height: 1.35;
	}

	.hosts {
		font-family: var(--font-script);
		font-size: clamp(2rem, 9vw, 2.5rem);
		line-height: 1.1;
	}

	.rose {
		position: absolute;
		z-index: 1;
		width: clamp(130px, 44%, 200px);
		height: auto;
		pointer-events: none;
		filter: drop-shadow(0 6px 10px color-mix(in oklab, var(--c-accent-deep) 30%, transparent));
	}

	/* The cut-out blooms along the top and left edges, so each corner mirrors it into place. */
	.rose-top {
		top: -1.6rem;
		right: -1.6rem;
		transform: scaleX(-1);
	}

	.rose-bottom {
		bottom: -1.6rem;
		left: -1.6rem;
		transform: scaleY(-1);
	}

	/* Roses grow in as the envelope opens. Already open, no JS or reduced motion: they are there. */
	@media (prefers-reduced-motion: no-preference) {
		.rose {
			transition:
				opacity 1.1s var(--ease-out) var(--bloom-delay, 0ms),
				scale 1.5s var(--ease-out) var(--bloom-delay, 0ms),
				rotate 1.5s var(--ease-out) var(--bloom-delay, 0ms);
		}

		.rose-bottom {
			--bloom-delay: 250ms;
		}

		:global(html.js:not(.envelope-opened)) .rose {
			opacity: 0;
			scale: 0.55;
			rotate: -10deg;
		}
	}
</style>
