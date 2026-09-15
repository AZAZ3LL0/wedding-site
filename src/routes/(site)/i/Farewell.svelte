<script lang="ts">
	import { Reveal, Section } from '$lib/ui';

	type Props = { eyebrow: string; monogram: string; hosts: string };

	let { eyebrow, monogram, hosts }: Props = $props();
</script>

<footer>
	<Section variant="dark">
		<Reveal>
			<div class="flex flex-col items-center gap-6 text-center">
				<p class="eyebrow text-ivory/80">{eyebrow}</p>
				<div class="relative grid h-48 w-38 place-items-center" aria-hidden="true">
					<svg viewBox="0 0 150 190" class="absolute inset-0 h-full w-full" fill="none">
						<ellipse cx="75" cy="95" rx="68" ry="86" stroke="currentColor" stroke-width="1.4" />
						<ellipse cx="75" cy="95" rx="62" ry="80" stroke="currentColor" stroke-width=".6" />
						<path
							d="M60 12c6-6 12-6 15 0 3-6 9-6 15 0M60 178c6 6 12 6 15 0 3 6 9 6 15 0"
							stroke="currentColor"
						/>
					</svg>
					<span class="translate-y-[6%] font-script text-7xl leading-none">{monogram}</span>
				</div>
				<p class="font-script text-5xl leading-tight">{hosts}</p>
			</div>
		</Reveal>
	</Section>
</footer>
