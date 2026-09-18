<script lang="ts">
	import { admin } from '$lib/content/admin';
	import type { AdminGuestRow } from '$lib/server/admin/repo';
	import PartySettings from './PartySettings.svelte';
	import { actionUrl, type Filters } from './filters';

	let { rows, filters }: { rows: AdminGuestRow[]; filters: Filters } = $props();

	const copy = admin.table;

	// A row is one guest, so the party settings repeat for every member of a party. They are shown
	// once, on the first row of the party.
	const firstOfParty = $derived(
		new Set(
			rows
				.filter((row, i) => rows.findIndex((r) => r.partyId === row.partyId) === i)
				.map((r) => r.id)
		)
	);

	const statusOf = (row: AdminGuestRow) => admin.status[row.rsvp?.attending ?? 'none'];
</script>

{#if rows.length === 0}
	<p class="rounded border border-slate-200 p-4 text-sm text-slate-600">{copy.empty}</p>
{:else}
	<div class="overflow-x-auto">
		<table class="w-full min-w-2xl border-collapse text-sm">
			<thead class="bg-slate-50 text-left text-xs text-slate-600">
				<tr>
					<th scope="col" class="p-2 font-medium">{copy.name}</th>
					<th scope="col" class="p-2 font-medium">{copy.status}</th>
					<th scope="col" class="p-2 font-medium">{copy.audience}</th>
					<th scope="col" class="p-2 font-medium">{copy.companion}</th>
					<th scope="col" class="p-2 font-medium">{copy.settings}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr class="border-t border-slate-200 align-top">
						<td class="p-2">
							<span class="font-medium">{row.name}</span>
							<span class="block text-xs text-slate-500">{row.partyTitle}</span>
							{#if row.isPlusOne}
								<span class="block text-xs text-slate-500">
									{copy.plusOne}
									{#if row.invitedByName}{copy.invitedBy} {row.invitedByName}{/if}
								</span>
							{/if}
						</td>
						<td class="p-2">
							<span
								class={[
									'rounded px-2 py-0.5 text-xs whitespace-nowrap',
									row.rsvp?.attending === 'yes' && 'bg-green-100 text-green-900',
									row.rsvp?.attending === 'no' && 'bg-red-100 text-red-900',
									!row.rsvp && 'bg-slate-100 text-slate-700'
								]}
							>
								{statusOf(row)}
							</span>
						</td>
						<td class="p-2 whitespace-nowrap">{admin.audience[row.audience]}</td>
						<td class="p-2">{row.companionName ?? copy.none}</td>
						<td class="p-2">
							{#if firstOfParty.has(row.id)}
								<PartySettings {row} {filters} />
							{/if}
							<form method="post" action={actionUrl('deleteGuest', filters)} class="mt-2">
								<input type="hidden" name="guestId" value={row.id} />
								<button
									type="submit"
									class="text-xs text-red-700 underline hover:text-red-900"
									onclick={(event) => {
										if (!confirm(admin.party.deleteConfirm)) event.preventDefault();
									}}
								>
									{admin.party.delete}
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
