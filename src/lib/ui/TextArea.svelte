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
		'w-full rounded-token border border-muted/50 bg-paper px-4 py-2 text-ink placeholder:text-muted focus-visible:border-forest focus-visible:outline-2 focus-visible:outline-forest aria-[invalid=true]:border-2 aria-[invalid=true]:border-ink',
		className
	]}></textarea>
