<script lang="ts">
	import { colorTokens, fontTokens, specimen } from './fixtures';
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-section">
	<section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		{#each colorTokens as token (token)}
			<figure class="flex flex-col gap-2">
				<div
					class="h-20 rounded-token border border-muted/40"
					style:background-color="var({token})"
					data-token={token}
				></div>
				<figcaption class="font-mono text-xs text-muted">{token}</figcaption>
			</figure>
		{/each}
	</section>

	<section class="flex flex-col gap-6">
		{#each fontTokens as font (font.token)}
			<figure class="flex flex-col gap-1">
				<p class={font.className} data-token={font.token}>{specimen}</p>
				<figcaption class="font-mono text-xs text-muted">{font.token}</figcaption>
			</figure>
		{/each}
	</section>
</main>
