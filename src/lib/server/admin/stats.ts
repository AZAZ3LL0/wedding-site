// Pure aggregation over the rows the repo returns, tech.md §13 task 4.3. Companions are guest
// rows of their own, so they land in every counter without a special case.
import type { AdminGuestRow } from './repo';

export type AdminStats = {
	total: number;
	attending: number;
	declined: number;
	noAnswer: number;
};

// The form asks whether the guest comes and nothing else, so these four numbers are the answer.
export function aggregate(rows: AdminGuestRow[]): AdminStats {
	const answered = rows.filter((row) => row.rsvp !== null);
	const coming = answered.filter((row) => row.rsvp!.attending === 'yes');

	return {
		total: rows.length,
		attending: coming.length,
		declined: answered.length - coming.length,
		noAnswer: rows.length - answered.length
	};
}
