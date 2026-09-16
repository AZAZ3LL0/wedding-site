<script lang="ts">
	import { admin } from '$lib/content/admin';
	import type { AdminStats } from '$lib/server/admin/stats';

	let { stats }: { stats: AdminStats } = $props();

	const copy = admin.stats;
	const numbers = $derived([
		{ label: copy.total, value: stats.total },
		{ label: copy.attending, value: stats.attending },
		{ label: copy.declined, value: stats.declined },
		{ label: copy.noAnswer, value: stats.noAnswer },
		{ label: copy.registry, value: stats.registry },
		{ label: copy.transfer, value: stats.transfer }
	]);
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-lg font-semibold">{copy.title}</h2>

	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
		{#each numbers as item (item.label)}
			<li class="rounded border border-slate-200 p-3">
				<span class="block text-2xl font-semibold tabular-nums">{item.value}</span>
				<span class="text-xs text-slate-600">{item.label}</span>
			</li>
		{/each}
	</ul>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each [{ title: copy.courses, items: stats.courses }, { title: copy.drinks, items: stats.drinks }] as group (group.title)}
			<div class="rounded border border-slate-200 p-3">
				<h3 class="mb-2 text-sm font-semibold">{group.title}</h3>
				<ul class="flex flex-col gap-1 text-sm">
					{#each group.items as option (option.id)}
						<li class="flex justify-between gap-4">
							<span>{option.label}</span>
							<span class="font-semibold tabular-nums">{option.count}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>

	<div class="rounded border border-slate-200 p-3">
		<h3 class="mb-2 text-sm font-semibold">{copy.allergies}</h3>
		{#if stats.allergies.length === 0}
			<p class="text-sm text-slate-600">{copy.noAllergies}</p>
		{:else}
			<ul class="flex flex-col gap-1 text-sm">
				{#each stats.allergies as entry (entry.name + entry.text)}
					<li><span class="font-medium">{entry.name}</span>: {entry.text}</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
