import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { admin } from '$lib/content/admin';
import type { AdminGuestRow, AdminRsvp } from './repo';
import { buildGuestWorkbook, exportFileName } from './export';

const answer = (over: Partial<AdminRsvp> = {}): AdminRsvp => ({
	attending: 'yes',
	updatedAt: '2026-06-01T10:00:00.000Z',
	...over
});

const row = (over: Partial<AdminGuestRow> = {}): AdminGuestRow => ({
	id: 'guest',
	firstName: 'Иван',
	lastName: 'Иванов',
	name: 'Иван Иванов',
	isPlusOne: false,
	invitedByName: null,
	companionName: null,
	partyId: 'party',
	partyTitle: 'Семья Ивановых',
	audience: 'family',
	plusOnePolicy: 'allowed',
	rsvp: null,
	...over
});

async function read(rows: AdminGuestRow[]) {
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(await buildGuestWorkbook(rows));
	const values = (sheet: ExcelJS.Worksheet, index: number) =>
		(sheet.getRow(index).values as (string | number | undefined)[]).slice(1);
	return { workbook, values };
}

describe('buildGuestWorkbook', () => {
	it('writes both sheets with the agreed headers', async () => {
		const { workbook, values } = await read([row()]);
		const guests = workbook.getWorksheet(admin.export.guestsSheet)!;
		const counts = workbook.getWorksheet(admin.export.countsSheet)!;

		expect(values(guests, 1)).toEqual(Object.values(admin.export.columns));
		expect(values(counts, 1)).toEqual([admin.export.metric, admin.export.value]);
	});

	it('writes one row per person, companions included', async () => {
		const { workbook, values } = await read([
			row({ id: 'a', rsvp: answer() }),
			row({
				id: 'b',
				firstName: 'Ольга',
				lastName: 'Смирнова',
				name: 'Ольга Смирнова',
				isPlusOne: true,
				invitedByName: 'Иван Иванов',
				rsvp: answer()
			}),
			row({ id: 'c', firstName: 'Мария', lastName: 'Иванова', name: 'Мария Иванова' })
		]);
		const sheet = workbook.getWorksheet(admin.export.guestsSheet)!;

		expect(sheet.rowCount).toBe(4);
		expect(values(sheet, 2)).toEqual([
			'Иван Иванов',
			'Семья Ивановых',
			admin.audience.family,
			admin.status.yes,
			''
		]);
		expect(values(sheet, 3)).toEqual([
			'Ольга Смирнова',
			'Семья Ивановых',
			admin.audience.family,
			admin.status.yes,
			'Иван Иванов'
		]);
		expect(values(sheet, 4)[3]).toBe(admin.status.none);
	});

	it('counts the same numbers the panel shows', async () => {
		const { workbook, values } = await read([
			row({ id: 'a', rsvp: answer() }),
			row({ id: 'b', isPlusOne: true, rsvp: answer() }),
			row({ id: 'c', rsvp: answer({ attending: 'no' }) }),
			row({ id: 'd' })
		]);
		const counts = workbook.getWorksheet(admin.export.countsSheet)!;

		expect(values(counts, 2)).toEqual([admin.stats.total, 4]);
		expect(values(counts, 3)).toEqual([admin.stats.attending, 2]);
		expect(values(counts, 4)).toEqual([admin.stats.declined, 1]);
		expect(values(counts, 5)).toEqual([admin.stats.noAnswer, 1]);
		expect(counts.rowCount).toBe(5);
	});

	it('produces an empty sheet for an empty guest list', async () => {
		const { workbook } = await read([]);
		expect(workbook.getWorksheet(admin.export.guestsSheet)!.rowCount).toBe(1);
	});
});

describe('exportFileName', () => {
	it('carries the date of the export', () => {
		expect(exportFileName(new Date('2026-09-16T10:00:00Z'))).toBe('guests-2026-09-16.xlsx');
	});
});
