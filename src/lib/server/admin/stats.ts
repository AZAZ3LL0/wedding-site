// Pure aggregation over the rows the repo returns, tech.md §13 task 4.3. Companions are guest
// rows of their own, so they land in every counter without a special case.
import type { ContentData } from '$lib/content/schema';
import type { AdminGuestRow } from './repo';

export type MenuTally = { id: string; label: string; count: number };

export type AdminStats = {
	total: number;
	attending: number;
	declined: number;
	noAnswer: number;
	registry: number;
	transfer: number;
	courses: MenuTally[];
	drinks: MenuTally[];
	allergies: { name: string; text: string }[];
};

type Menu = Pick<ContentData['menu'], 'courses' | 'drinks'>;

export function guestName(row: Pick<AdminGuestRow, 'firstName' | 'lastName'>): string {
	return [row.firstName, row.lastName].filter(Boolean).join(' ');
}

// One vote per guest per option: a repeated id is rejected on write, and a menu id that no longer
// exists is dropped instead of showing up as a slug.
function tally(options: { id: string; label: string }[], picks: string[][]): MenuTally[] {
	return options.map(({ id, label }) => ({
		id,
		label,
		count: picks.filter((ids) => ids.includes(id)).length
	}));
}

export function aggregate(rows: AdminGuestRow[], menu: Menu): AdminStats {
	const answered = rows.flatMap((row) => (row.rsvp ? [{ row, rsvp: row.rsvp }] : []));
	const coming = answered.filter(({ rsvp }) => rsvp.attending === 'yes');

	return {
		total: rows.length,
		attending: coming.length,
		declined: answered.length - coming.length,
		noAnswer: rows.length - answered.length,
		registry: coming.filter(({ rsvp }) => rsvp.attendingRegistry).length,
		transfer: coming.filter(({ rsvp }) => rsvp.needsTransfer).length,
		courses: tally(
			menu.courses,
			coming.map(({ rsvp }) => rsvp.mainCourses)
		),
		drinks: tally(
			menu.drinks,
			coming.map(({ rsvp }) => rsvp.drinks)
		),
		allergies: coming.flatMap(({ row, rsvp }) =>
			rsvp.allergies ? [{ name: guestName(row), text: rsvp.allergies }] : []
		)
	};
}
