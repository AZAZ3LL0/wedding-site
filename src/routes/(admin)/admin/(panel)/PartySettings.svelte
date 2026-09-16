<script lang="ts">
	import { admin } from '$lib/content/admin';
	import type { AdminGuestRow } from '$lib/server/admin/repo';
	import { AUDIENCE_OPTIONS } from './filters';

	let { row }: { row: AdminGuestRow } = $props();

	const copy = admin.party;
	const audiences = AUDIENCE_OPTIONS.filter((value) => value !== 'all');
	const policies = ['none', 'allowed'] as const;
</script>

<!-- Changes the party, not the guest: every member of the party moves together. -->
<form method="post" action="?/updateParty" class="flex flex-col gap-1 text-xs">
	<input type="hidden" name="partyId" value={row.partyId} />

	<label class="sr-only" for="audience-{row.partyId}">{admin.table.audience}</label>
	<select
		id="audience-{row.partyId}"
		name="audience"
		value={row.audience}
		class="min-h-8 rounded border border-slate-300 px-1"
	>
		{#each audiences as value (value)}
			<option {value}>{admin.audience[value]}</option>
		{/each}
	</select>

	<label class="sr-only" for="policy-{row.partyId}">{copy.plusOnePolicy}</label>
	<select
		id="policy-{row.partyId}"
		name="plusOnePolicy"
		value={row.plusOnePolicy}
		class="min-h-8 rounded border border-slate-300 px-1"
	>
		{#each policies as value (value)}
			<option {value}>{admin.plusOnePolicy[value]}</option>
		{/each}
	</select>

	<label class="flex items-center gap-1">
		<input type="checkbox" name="invitedToRegistry" checked={row.invitedToRegistry} />
		{copy.invitedToRegistry}
	</label>

	<button type="submit" class="min-h-8 rounded border border-slate-300 px-2 hover:bg-slate-50">
		{copy.save}
	</button>
</form>
