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

<article
	class="overflow-hidden rounded-token border border-gold/40 bg-ivory text-ink shadow-[0_14px_30px_rgb(79_17_28/0.1)]"
>
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
	<div class="flex flex-col items-center gap-3 px-5 py-7 text-center">
		<h3 class="font-display text-3xl leading-tight text-accent">{title}</h3>
		<!-- The address is what guests type into a taxi app, so it reads at full size. -->
		<p class="text-xl leading-snug">{address}</p>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- external map service, not an app route -->
		<a
			href={mapUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="mt-3 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-8 py-3 font-medium tracking-wide text-ivory ring-1 ring-gold ring-offset-2 ring-offset-ivory transition-colors duration-(--dur-fast) ease-out hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
		>
			{linkLabel}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
</article>
