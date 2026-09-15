import type { ContentData } from '$lib/content/schema';
import type { Companion } from '$lib/server/rsvp/repo';
import type { RsvpPublic } from '$lib/types';

export type SummaryRow = { label: string; value: string };

type Copy = Pick<ContentData, 'rsvp' | 'thanks' | 'menu'>;

// An id the menu no longer has is skipped rather than shown to the guest as a slug.
function choices(ids: string[], options: { id: string; label: string }[], empty: string): string {
	const labels = ids.flatMap((id) => options.find((option) => option.id === id)?.label ?? []);
	return labels.length > 0 ? labels.join(', ') : empty;
}

export function answerRows(
	rsvp: RsvpPublic,
	telegramUsername: string | null,
	{ rsvp: copy, thanks, menu }: Copy
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
		rows.push(
			{ label: copy.coursesLabel, value: choices(rsvp.mainCourses, menu.courses, thanks.empty) },
			{ label: copy.drinksLabel, value: choices(rsvp.drinks, menu.drinks, thanks.empty) }
		);
		if (rsvp.allergies) rows.push({ label: copy.allergiesLabel, value: rsvp.allergies });
		if (rsvp.needsTransfer) rows.push({ label: copy.transferLabel, value: copy.transferOption });
	}
	if (rsvp.comment) rows.push({ label: copy.commentLabel, value: rsvp.comment });
	if (telegramUsername) rows.push({ label: copy.telegramLabel, value: `@${telegramUsername}` });
	return rows;
}

export function companionSummary(
	companion: Companion,
	{ rsvp: copy, thanks, menu }: Copy
): { name: string; rows: SummaryRow[] } {
	return {
		name: [companion.firstName, companion.lastName].filter(Boolean).join(' '),
		rows: [
			{
				label: copy.coursesLabel,
				value: choices(companion.mainCourses, menu.courses, thanks.empty)
			},
			{ label: copy.drinksLabel, value: choices(companion.drinks, menu.drinks, thanks.empty) }
		]
	};
}
