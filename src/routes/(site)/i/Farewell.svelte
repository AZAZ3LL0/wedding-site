<script lang="ts">
	import { Reveal, ScriptText, Section } from '$lib/ui';

	type Props = { eyebrow: string; monogram: string; hosts: string };

	let { eyebrow, monogram, hosts }: Props = $props();
</script>

<footer>
	<Section variant="dark">
		<Reveal>
			<div class="flex flex-col items-center gap-6 text-center">
				<p class="eyebrow text-ivory/80">{eyebrow}</p>
				<div class="relative grid size-40 place-items-center text-gold" aria-hidden="true">
					<svg viewBox="0 0 160 160" class="absolute inset-0 h-full w-full" fill="none">
						<circle cx="80" cy="80" r="74" stroke="currentColor" stroke-width="1.4" />
						<circle
							cx="80"
							cy="80"
							r="66"
							stroke="currentColor"
							stroke-width=".7"
							stroke-dasharray="1.5 4"
						/>
					</svg>
					<!-- The same thin roman capital as the envelope seal. -->
					<span class="font-display text-7xl leading-none font-light">{monogram}</span>
				</div>
				<p class="font-script text-5xl leading-tight"><ScriptText text={hosts} /></p>
			</div>
		</Reveal>
	</Section>
</footer>
