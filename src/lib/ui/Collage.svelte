<script lang="ts">
	type Props = { images: { src: string; alt: string; span: 1 | 2 }[] };

	let { images }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-2">
	{#each images as image (image.src)}
		<img
			src={image.src}
			alt={image.alt}
			loading="lazy"
			decoding="async"
			class={[
				'h-full w-full rounded-token object-cover',
				image.span === 2 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'
			]}
		/>
	{/each}
</div>
