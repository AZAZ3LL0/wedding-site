<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button, Heading } from '$lib/ui';
	import { sample } from '../fixtures';

	let { data } = $props();
	let sending = $state(false);

	// The worker delivers asynchronously, so the page polls the fake inbox.
	onMount(() => {
		const timer = setInterval(() => void invalidateAll(), 1000);
		return () => clearInterval(timer);
	});
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-section">
	<Heading level={2}>{sample.telegram.title}</Heading>

	<form
		method="POST"
		action="?/ping"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update();
				sending = false;
			};
		}}
	>
		<Button variant="solid" type="submit" loading={sending}>{sample.telegram.send}</Button>
	</form>

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
