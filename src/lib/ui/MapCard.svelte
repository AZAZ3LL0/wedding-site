<script lang="ts">
	type Props = {
		title: string;
		address: string;
		mapUrl: string;
		photos: { src: string; alt: string }[];
		linkLabel: string;
	};

	let { title, address, mapUrl, photos, linkLabel }: Props = $props();
</script>

<article class="overflow-hidden rounded-token border border-muted/30 bg-ivory text-ink">
	{#if photos.length > 0}
		<div class="flex snap-x gap-1 overflow-x-auto">
			{#each photos as photo (photo.src)}
				<img
					src={photo.src}
					alt={photo.alt}
					loading="lazy"
					decoding="async"
					class="aspect-[4/3] w-full shrink-0 snap-start object-cover"
				/>
			{/each}
		</div>
	{/if}
	<div class="flex flex-col gap-2 p-5">
		<h3 class="font-display text-2xl">{title}</h3>
		<p class="text-sm text-olive">{address}</p>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- external map service, not an app route -->
		<a
			href={mapUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="self-start text-olive-deep underline underline-offset-4"
		>
			{linkLabel}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
</article>
