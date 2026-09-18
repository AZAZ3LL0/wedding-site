<script lang="ts">
	import { admin } from '$lib/content/admin';
	import type { AdminStats } from '$lib/server/admin/stats';

	let { stats }: { stats: AdminStats } = $props();

	const copy = admin.stats;
	const numbers = $derived([
		{ label: copy.total, value: stats.total },
		{ label: copy.attending, value: stats.attending },
		{ label: copy.declined, value: stats.declined },
		{ label: copy.noAnswer, value: stats.noAnswer }
	]);
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-lg font-semibold">{copy.title}</h2>

	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each numbers as item (item.label)}
			<li class="rounded border border-slate-200 p-3">
				<span class="block text-2xl font-semibold tabular-nums">{item.value}</span>
				<span class="text-xs text-slate-600">{item.label}</span>
			</li>
		{/each}
	</ul>
</section>
