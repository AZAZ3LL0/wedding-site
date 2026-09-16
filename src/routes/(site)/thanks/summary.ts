import type { ContentData } from '$lib/content/schema';
import type { Companion } from '$lib/server/rsvp/repo';
import type { RsvpPublic } from '$lib/types';

export type SummaryRow = { label: string; value: string };

type Copy = Pick<ContentData, 'rsvp'>;

// The form no longer asks about dishes and drinks, so neither does the summary of the answer.
export function answerRows(
	rsvp: RsvpPublic,
	telegramUsername: string | null,
	{ rsvp: copy }: Copy
): SummaryRow[] {
	const rows: SummaryRow[] = [
		{
			label: copy.attendingLabel,
			value: rsvp.attending === 'yes' ? copy.attendingYes : copy.attendingNo
		}
	];
	if (rsvp.attending === 'yes') {
		if (rsvp.attendingRegistry)
			rows.push({ label: copy.registryLabel, value: copy.registryOption });
		if (rsvp.allergies) rows.push({ label: copy.allergiesLabel, value: rsvp.allergies });
		if (rsvp.needsTransfer) rows.push({ label: copy.transferLabel, value: copy.transferOption });
	}
	if (rsvp.comment) rows.push({ label: copy.commentLabel, value: rsvp.comment });
	if (telegramUsername) rows.push({ label: copy.telegramLabel, value: `@${telegramUsername}` });
	return rows;
}

export function companionSummary(companion: Companion): { name: string; rows: SummaryRow[] } {
	return { name: [companion.firstName, companion.lastName].filter(Boolean).join(' '), rows: [] };
}
