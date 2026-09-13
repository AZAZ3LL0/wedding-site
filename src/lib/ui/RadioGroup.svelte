<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		options: { id: string; label: string }[];
		value?: string;
		name: string;
		required?: boolean;
		disabled?: boolean;
	};

	let {
		options,
		value = $bindable(),
		name,
		required = false,
		disabled = false,
		...rest
	}: Props = $props();
</script>

<div role="radiogroup" {...rest} class="flex flex-col gap-2">
	{#each options as option (option.id)}
		<label class="flex min-h-11 cursor-pointer items-center gap-3">
			<input
				type="radio"
				{name}
				value={option.id}
				{required}
				{disabled}
				bind:group={value}
				class="h-5 w-5 accent-forest"
			/>
			<span>{option.label}</span>
		</label>
	{/each}
</div>
