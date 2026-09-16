<script lang="ts">
	import { resolve } from '$app/paths';
	import { admin } from '$lib/content/admin';
	import Filters from './Filters.svelte';
	import GuestTable from './GuestTable.svelte';
	import Stats from './Stats.svelte';

	let { data, form } = $props();

	const notices = {
		saved: admin.party.saved,
		deleted: admin.party.deleted,
		failed: admin.party.failed
	};
	const menu = $derived([...data.menu.courses, ...data.menu.drinks]);
</script>

<header
	class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4"
>
	<h1 class="text-xl font-semibold">{admin.title}</h1>
	<div class="flex items-center gap-4">
		<a
			href={resolve('/admin/export')}
			class="text-sm text-slate-600 underline hover:text-slate-900"
		>
			{admin.export.link}
		</a>
		<form method="post" action="?/signOut">
			<button type="submit" class="text-sm text-slate-600 underline hover:text-slate-900">
				{admin.nav.signOut}
			</button>
		</form>
	</div>
</header>

<main class="flex flex-col gap-6 px-6 py-6">
	{#if form?.notice}
		<p
			role="status"
			class={[
				'rounded px-3 py-2 text-sm',
				form.notice === 'failed' ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'
			]}
		>
			{notices[form.notice]}
		</p>
	{/if}

	<Stats stats={data.stats} />

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold">{admin.nav.guests}</h2>
		<Filters filters={data.filters} />
		<p class="text-sm text-slate-600">{admin.filters.found}: {data.rows.length}</p>
		<GuestTable rows={data.rows} {menu} filters={data.filters} />
	</section>
</main>
