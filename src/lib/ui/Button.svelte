<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant: 'solid' | 'ghost';
		loading?: boolean;
		type?: 'button' | 'submit' | 'reset';
		children: Snippet;
	};

	let {
		variant,
		loading = false,
		type = 'button',
		disabled,
		children,
		class: className,
		...rest
	}: Props = $props();
</script>

<button
	{...rest}
	{type}
	disabled={disabled || loading}
	aria-busy={loading}
	class={[
		'relative inline-flex min-h-11 items-center justify-center rounded-token px-6 py-3 font-medium transition-opacity duration-(--dur-fast) ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-60',
		variant === 'solid'
			? 'bg-forest text-paper hover:opacity-90'
			: 'border border-forest text-forest hover:bg-forest/5',
		className
	]}
>
	<span class={[loading && 'invisible']}>{@render children()}</span>
	{#if loading}
		<span
			class="absolute h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
			aria-hidden="true"
		></span>
	{/if}
</button>
