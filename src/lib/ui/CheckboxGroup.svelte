<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { isAtLimit, toggleValue } from './checkbox-group';

	type Props = HTMLAttributes<HTMLDivElement> & {
		options: { id: string; label: string }[];
		values?: string[];
		max?: number;
		name: string;
		disabled?: boolean;
	};

	let { options, values = $bindable([]), max, name, disabled = false, ...rest }: Props = $props();
</script>

<!-- Without JS the limit is not enforced here; the server validates the submitted values. -->
<div role="group" {...rest} class="flex flex-col gap-2">
	{#each options as option (option.id)}
		<label class="flex min-h-11 cursor-pointer items-center gap-3">
			<input
				type="checkbox"
				{name}
				value={option.id}
				checked={values.includes(option.id)}
				disabled={disabled || isAtLimit(values, option.id, max)}
				onchange={() => (values = toggleValue(values, option.id, max))}
				class="h-5 w-5 accent-forest"
			/>
			<span>{option.label}</span>
		</label>
	{/each}
</div>
