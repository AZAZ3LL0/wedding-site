// The xlsx the venue gets, tech.md §13 task 4.4: one row per person, plus the counters sheet.
import ExcelJS from 'exceljs';
import { admin } from '$lib/content/admin';
import type { AdminGuestRow } from './repo';
import { aggregate } from './stats';

const copy = admin.export;

export function exportFileName(now: Date): string {
	return `${copy.fileName}-${now.toISOString().slice(0, 10)}.xlsx`;
}

// The return type stays inferred: exceljs merges its own `Buffer` into the global one, and naming
// it here would clash with Node's.
export async function buildGuestWorkbook(rows: AdminGuestRow[]) {
	const workbook = new ExcelJS.Workbook();

	const sheet = workbook.addWorksheet(copy.guestsSheet);
	sheet.columns = [
		{ header: copy.columns.name, key: 'name', width: 26 },
		{ header: copy.columns.party, key: 'party', width: 26 },
		{ header: copy.columns.audience, key: 'audience', width: 12 },
		{ header: copy.columns.status, key: 'status', width: 12 },
		{ header: copy.columns.plusOne, key: 'plusOne', width: 22 }
	];
	sheet.getRow(1).font = { bold: true };
	sheet.views = [{ state: 'frozen', ySplit: 1 }];

	for (const row of rows) {
		sheet.addRow({
			name: row.name,
			party: row.partyTitle,
			audience: admin.audience[row.audience],
			status: admin.status[row.rsvp?.attending ?? 'none'],
			plusOne: row.isPlusOne ? (row.invitedByName ?? copy.yes) : ''
		});
	}

	const stats = aggregate(rows);
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
		[admin.stats.noAnswer, stats.noAnswer]
	] as [string, number][]) {
		counts.addRow({ metric, value });
	}

	return workbook.xlsx.writeBuffer();
}
