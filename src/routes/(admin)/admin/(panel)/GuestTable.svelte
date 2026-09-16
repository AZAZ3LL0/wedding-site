<script lang="ts">
	import { admin } from '$lib/content/admin';
	import type { AdminGuestRow } from '$lib/server/admin/repo';
	import { guestName } from '$lib/server/admin/stats';
	import PartySettings from './PartySettings.svelte';

	let { rows, menu }: { rows: AdminGuestRow[]; menu: { id: string; label: string }[] } = $props();

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

	const labels = (ids: string[]) =>
		ids.flatMap((id) => menu.find((option) => option.id === id)?.label ?? []).join(', ');

	const statusOf = (row: AdminGuestRow) => admin.status[row.rsvp?.attending ?? 'none'];
</script>

{#if rows.length === 0}
	<p class="rounded border border-slate-200 p-4 text-sm text-slate-600">{copy.empty}</p>
{:else}
	<div class="overflow-x-auto">
		<table class="w-full min-w-3xl border-collapse text-sm">
			<thead class="bg-slate-50 text-left text-xs text-slate-600">
				<tr>
					<th scope="col" class="p-2 font-medium">{copy.name}</th>
					<th scope="col" class="p-2 font-medium">{copy.status}</th>
					<th scope="col" class="p-2 font-medium">{copy.audience}</th>
					<th scope="col" class="p-2 font-medium">{copy.companion}</th>
					<th scope="col" class="p-2 font-medium">{copy.telegram}</th>
					<th scope="col" class="p-2 font-medium">{copy.menu}</th>
					<th scope="col" class="p-2 font-medium">{copy.notes}</th>
					<th scope="col" class="p-2 font-medium">{copy.settings}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr class="border-t border-slate-200 align-top">
						<td class="p-2">
							<span class="font-medium">{guestName(row)}</span>
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
							{#if row.rsvp?.attendingRegistry}
								<span class="block text-xs text-slate-500">{admin.export.columns.registry}</span>
							{/if}
							{#if row.rsvp?.needsTransfer}
								<span class="block text-xs text-slate-500">{admin.export.columns.transfer}</span>
							{/if}
						</td>
						<td class="p-2 whitespace-nowrap">{admin.audience[row.audience]}</td>
						<td class="p-2">{row.companionName ?? copy.none}</td>
						<td class="p-2">
							{row.telegramUsername ? `@${row.telegramUsername}` : copy.none}
							{#if row.telegramLinked}
								<span class="block text-xs text-green-800">{copy.telegramLinked}</span>
							{/if}
						</td>
						<td class="p-2">
							{#if row.rsvp}
								<span class="block">{labels(row.rsvp.mainCourses) || copy.none}</span>
								<span class="block text-xs text-slate-500">
									{labels(row.rsvp.drinks) || copy.none}
								</span>
							{:else}
								{copy.none}
							{/if}
						</td>
						<td class="p-2">
							{#if row.rsvp?.allergies}<span class="block">{row.rsvp.allergies}</span>{/if}
							{#if row.rsvp?.comment}
								<span class="block text-xs text-slate-500">{row.rsvp.comment}</span>
							{/if}
						</td>
						<td class="p-2">
							{#if firstOfParty.has(row.id)}
								<PartySettings {row} />
							{/if}
							<form method="post" action="?/deleteGuest" class="mt-2">
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
