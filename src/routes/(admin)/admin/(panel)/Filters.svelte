<script lang="ts">
	import { admin } from '$lib/content/admin';
	import { AUDIENCE_OPTIONS, STATUS_OPTIONS, type Filters } from './filters';

	let { filters }: { filters: Filters } = $props();

	const copy = admin.filters;
	const statusLabel = (value: (typeof STATUS_OPTIONS)[number]) =>
		value === 'all' ? copy.all : admin.status[value];
	const audienceLabel = (value: (typeof AUDIENCE_OPTIONS)[number]) =>
		value === 'all' ? copy.all : admin.audience[value];
</script>

<!-- A plain GET form: filters end up in the URL and the panel works without JavaScript. -->
<form method="get" class="flex flex-wrap items-end gap-3">
	<div class="flex flex-col gap-1">
		<label class="text-xs font-medium text-slate-600" for="filter-search">{copy.search}</label>
		<input
			id="filter-search"
			name="search"
			value={filters.search}
			placeholder={copy.searchPlaceholder}
			maxlength="60"
			class="min-h-10 rounded border border-slate-300 px-3"
		/>
	</div>

	<div class="flex flex-col gap-1">
		<label class="text-xs font-medium text-slate-600" for="filter-status">{copy.status}</label>
		<select
			id="filter-status"
			name="status"
			value={filters.status}
			class="min-h-10 rounded border border-slate-300 px-2"
		>
			{#each STATUS_OPTIONS as option (option)}
				<option value={option}>{statusLabel(option)}</option>
			{/each}
		</select>
	</div>

	<div class="flex flex-col gap-1">
		<label class="text-xs font-medium text-slate-600" for="filter-audience">{copy.audience}</label>
		<select
			id="filter-audience"
			name="audience"
			value={filters.audience}
			class="min-h-10 rounded border border-slate-300 px-2"
		>
			{#each AUDIENCE_OPTIONS as option (option)}
				<option value={option}>{audienceLabel(option)}</option>
			{/each}
		</select>
	</div>

	<button
		type="submit"
		class="min-h-10 rounded bg-slate-900 px-4 font-medium text-white hover:bg-slate-700"
	>
		{copy.apply}
	</button>
	<a href="/admin" class="min-h-10 px-2 py-2 text-sm text-slate-600 underline hover:text-slate-900">
		{copy.reset}
	</a>
</form>
