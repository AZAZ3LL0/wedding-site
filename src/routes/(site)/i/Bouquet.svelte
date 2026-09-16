<script lang="ts">
	import { petal } from './ornaments';

	type Props = { flowers: number; class?: string };

	let { flowers, class: className }: Props = $props();

	const id = $props.id();

	// Cosmos heads as on the printed invitation: [x, y, radius, rotation], largest first.
	const heads = [
		[95, 95, 62, 8],
		[150, 150, 44, 30],
		[48, 158, 38, -12],
		[150, 60, 32, 20],
		[60, 55, 26, 40]
	] as const;

	const shown = $derived(heads.slice(0, flowers).reverse());
</script>

<svg viewBox="0 0 200 220" class={className} aria-hidden="true">
	<defs>
		<radialGradient id="{id}-petal" cx="50%" cy="100%" r="100%" fx="50%" fy="100%">
			<stop offset="0" style:stop-color="color-mix(in oklab, var(--c-wine) 60%, black)" />
			<stop offset=".45" style:stop-color="var(--c-wine)" />
			<stop offset="1" style:stop-color="color-mix(in oklab, var(--c-wine) 80%, white)" />
		</radialGradient>
	</defs>
	<path d="M100 200C80 160 60 130 30 120 60 118 90 140 100 200" style:fill="var(--c-accent)" />
	<path d="M110 205C130 170 160 150 190 150 160 140 120 160 110 205" style:fill="var(--c-accent)" />
	{#each shown as [x, y, r, rotation] (`${x}-${y}`)}
		<g transform="translate({x} {y}) rotate({rotation})">
			{#each { length: 8 }, i (i)}
				<path
					d={petal(r)}
					fill="url(#{id}-petal)"
					stroke="black"
					stroke-opacity=".2"
					stroke-width=".6"
					transform="rotate({i * 45 + (i % 2) * 6})"
				/>
			{/each}
			<circle r={r * 0.2} style:fill="color-mix(in oklab, var(--c-wine) 45%, black)" />
			{#each { length: 10 }, i (i)}
				<circle
					cx={Math.cos((i / 10) * Math.PI * 2) * r * 0.13}
					cy={Math.sin((i / 10) * Math.PI * 2) * r * 0.13}
					r={r * 0.035}
					style:fill="var(--c-paper)"
				/>
			{/each}
		</g>
	{/each}
</svg>
