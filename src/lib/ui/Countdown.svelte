<script lang="ts">
	import { onMount } from 'svelte';
	import type { PluralForms } from '$lib/types';
	import { pluralForm, splitDuration } from './countdown';

	type Props = {
		target: string;
		labels: { days: PluralForms; hours: PluralForms; minutes: PluralForms; seconds: PluralForms };
	};

	let { target, labels }: Props = $props();

	let now = $state(Date.now());
	const parts = $derived(splitDuration(Date.parse(target), now));
	const units = $derived([
		{ key: 'days', value: parts.days, forms: labels.days },
		{ key: 'hours', value: parts.hours, forms: labels.hours },
		{ key: 'minutes', value: parts.minutes, forms: labels.minutes },
		{ key: 'seconds', value: parts.seconds, forms: labels.seconds }
	]);

	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
</script>

<time datetime={target} class="grid grid-cols-4 gap-4 text-center">
	{#each units as unit (unit.key)}
		<span class="flex flex-col">
			<span class="font-display text-4xl lining-nums tabular-nums">{unit.value}</span>
			<span class="text-xs tracking-widest text-olive uppercase">
				{pluralForm(unit.value, unit.forms)}
			</span>
		</span>
	{/each}
</time>
