<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = Omit<HTMLTextareaAttributes, 'value'> & {
		value?: string;
		placeholder?: string;
		maxlength?: number;
	};

	let { value = $bindable(''), class: className, ...rest }: Props = $props();
</script>

<textarea
	rows="4"
	{...rest}
	bind:value
	class={[
		'w-full rounded-token border border-muted/50 bg-ivory px-4 py-2 text-ink placeholder:text-muted focus-visible:border-olive focus-visible:outline-2 focus-visible:outline-olive aria-[invalid=true]:border-2 aria-[invalid=true]:border-wine',
		className
	]}></textarea>
