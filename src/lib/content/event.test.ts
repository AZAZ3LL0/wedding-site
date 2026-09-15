import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dateParts, eventStart } from './event';
import { contentSchema } from './schema';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

const event = fc
	.record({
		year: fc.integer({ min: 2000, max: 2099 }),
		month: fc.integer({ min: 1, max: 12 }),
		day: fc.integer({ min: 1, max: 28 }),
		hour: fc.integer({ min: 0, max: 23 }),
		minute: fc.integer({ min: 0, max: 59 }),
		offsetMinutes: fc.integer({ min: -12 * 60, max: 14 * 60 })
	})
	.map((e) => {
		const sign = e.offsetMinutes < 0 ? '-' : '+';
		const abs = Math.abs(e.offsetMinutes);
		return {
			...e,
			date: `${e.year}-${pad(e.month)}-${pad(e.day)}`,
			time: `${pad(e.hour)}:${pad(e.minute)}`,
			utcOffset: `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
		};
	});

describe('eventStart', () => {
	it('matches the example from tech.md §7', () => {
		expect(eventStart({ date: '2026-11-28', time: '17:00', utcOffset: '+04:00' })).toBe(
			'2026-11-28T17:00:00+04:00'
		);
	});

	it('is the local wall time shifted by the offset, whatever the runtime zone', () => {
		fc.assert(
			fc.property(event, (e) => {
				const utc = Date.UTC(e.year, e.month - 1, e.day, e.hour, e.minute);
				expect(Date.parse(eventStart(e))).toBe(utc - e.offsetMinutes * 60_000);
			})
		);
	});

	it('works on every event the content schema accepts', () => {
		fc.assert(
			fc.property(event, (e) => {
				const parsed = contentSchema.shape.event.safeParse({
					title: 'Кыз Узату',
					date: e.date,
					time: e.time,
					utcOffset: e.utcOffset,
					rsvpDeadline: e.date,
					city: 'Астрахань'
				});
				expect(parsed.success).toBe(true);
			})
		);
	});
});

describe('dateParts', () => {
	it('splits an ISO date into day, month and year', () => {
		fc.assert(
			fc.property(event, (e) => {
				expect(dateParts(e.date)).toEqual([pad(e.day), pad(e.month), String(e.year)]);
			})
		);
	});
});
