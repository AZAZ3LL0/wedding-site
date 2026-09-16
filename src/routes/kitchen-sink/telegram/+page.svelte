<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Heading } from '$lib/ui';
	import { sample } from '../fixtures';

	let { data } = $props();

	// The worker delivers asynchronously, so the page polls the fake inbox.
	onMount(() => {
		const timer = setInterval(() => void invalidateAll(), 1000);
		return () => clearInterval(timer);
	});
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-section">
	<Heading level={2}>{sample.telegram.title}</Heading>

	{#if data.messages.length === 0}
		<p class="text-muted">{sample.telegram.empty}</p>
	{:else}
		<ol class="flex flex-col gap-3">
			{#each data.messages as message (message.messageId)}
				<li data-message class="rounded-token border border-muted/30 p-4">
					<p class="font-mono text-xs text-muted">
						#{message.messageId} → {message.chatId} · {message.sentAt}
					</p>
					<p>{message.text}</p>
				</li>
			{/each}
		</ol>
	{/if}
</main>
