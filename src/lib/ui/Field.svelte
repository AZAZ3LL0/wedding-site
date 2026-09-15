<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		label: string;
		error?: string;
		required?: boolean;
		// The control receives the id: `<TextInput id={id} aria-describedby="{id}-error" />`, or
		// `aria-labelledby="{id}-label"` for groups, which a <label for> cannot point at.
		children: Snippet<[id: string]>;
	};

	let { label, error, required = false, children }: Props = $props();

	const id = $props.id();
</script>

<div class="flex flex-col gap-2">
	<label for={id} id="{id}-label" class="text-sm font-medium">
		{label}
		{#if required}<span class="text-wine" aria-hidden="true">*</span>{/if}
	</label>
	{@render children(id)}
	{#if error}
		<p id="{id}-error" class="text-sm font-medium text-wine" aria-live="polite">{error}</p>
	{/if}
</div>
