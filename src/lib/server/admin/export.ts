// The xlsx the venue gets, tech.md §13 task 4.4: one row per person, plus the counters sheet.
import ExcelJS from 'exceljs';
import { admin } from '$lib/content/admin';
import type { ContentData } from '$lib/content/schema';
import type { AdminGuestRow } from './repo';
import { aggregate, guestName } from './stats';

type Menu = Pick<ContentData['menu'], 'courses' | 'drinks'>;

const copy = admin.export;

const flag = (value: boolean) => (value ? copy.yes : copy.no);

function labelsOf(ids: string[], options: { id: string; label: string }[]): string {
	return ids.flatMap((id) => options.find((option) => option.id === id)?.label ?? []).join(', ');
}

export function exportFileName(now: Date): string {
	return `${copy.fileName}-${now.toISOString().slice(0, 10)}.xlsx`;
}

// The return type stays inferred: exceljs merges its own `Buffer` into the global one, and naming
// it here would clash with Node's.
export async function buildGuestWorkbook(rows: AdminGuestRow[], menu: Menu) {
	const workbook = new ExcelJS.Workbook();

	const sheet = workbook.addWorksheet(copy.guestsSheet);
	sheet.columns = [
		{ header: copy.columns.name, key: 'name', width: 26 },
		{ header: copy.columns.party, key: 'party', width: 26 },
		{ header: copy.columns.audience, key: 'audience', width: 12 },
		{ header: copy.columns.status, key: 'status', width: 12 },
		{ header: copy.columns.plusOne, key: 'plusOne', width: 22 },
		{ header: copy.columns.registry, key: 'registry', width: 8 },
		{ header: copy.columns.courses, key: 'courses', width: 22 },
		{ header: copy.columns.drinks, key: 'drinks', width: 22 },
		{ header: copy.columns.allergies, key: 'allergies', width: 26 },
		{ header: copy.columns.transfer, key: 'transfer', width: 10 },
		{ header: copy.columns.comment, key: 'comment', width: 30 },
		{ header: copy.columns.telegram, key: 'telegram', width: 18 }
	];
	sheet.getRow(1).font = { bold: true };
	sheet.views = [{ state: 'frozen', ySplit: 1 }];

	for (const row of rows) {
		sheet.addRow({
			name: guestName(row),
			party: row.partyTitle,
			audience: admin.audience[row.audience],
			status: admin.status[row.rsvp?.attending ?? 'none'],
			plusOne: row.isPlusOne ? (row.invitedByName ?? copy.yes) : '',
			registry: flag(row.rsvp?.attendingRegistry ?? false),
			courses: row.rsvp ? labelsOf(row.rsvp.mainCourses, menu.courses) : '',
			drinks: row.rsvp ? labelsOf(row.rsvp.drinks, menu.drinks) : '',
			allergies: row.rsvp?.allergies ?? '',
			transfer: flag(row.rsvp?.needsTransfer ?? false),
			comment: row.rsvp?.comment ?? '',
			telegram: row.telegramUsername ? `@${row.telegramUsername}` : ''
		});
	}

	const stats = aggregate(rows, menu);
	const counts = workbook.addWorksheet(copy.countsSheet);
	counts.columns = [
		{ header: copy.metric, key: 'metric', width: 30 },
		{ header: copy.value, key: 'value', width: 12 }
	];
	counts.getRow(1).font = { bold: true };
	for (const [metric, value] of [
		[admin.stats.total, stats.total],
		[admin.stats.attending, stats.attending],
		[admin.stats.declined, stats.declined],
		[admin.stats.noAnswer, stats.noAnswer],
		[admin.stats.registry, stats.registry],
		[admin.stats.transfer, stats.transfer],
		...stats.courses.map((option) => [option.label, option.count] as const),
		...stats.drinks.map((option) => [option.label, option.count] as const)
	] as [string, number][]) {
		counts.addRow({ metric, value });
	}

	return workbook.xlsx.writeBuffer();
}
