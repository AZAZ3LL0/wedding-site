<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLElement> & {
		variant: 'light' | 'dark';
		padded?: boolean;
		children: Snippet;
	};

	let { variant, padded = true, children, class: className, ...rest }: Props = $props();
</script>

<section
	{...rest}
	class={[
		variant === 'dark' ? 'bg-olive-deep text-ivory' : 'bg-paper text-ink',
		padded && 'px-6 py-section',
		className
	]}
>
	{@render children()}
</section>
