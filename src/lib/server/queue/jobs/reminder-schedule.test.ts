import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { daysBetween, stageFor, todayAt } from './reminder-schedule';

describe('daysBetween', () => {
	it('counts whole calendar days', () => {
		expect(daysBetween('2026-10-29', '2026-11-28')).toBe(30);
		expect(daysBetween('2026-11-21', '2026-11-28')).toBe(7);
	});

	it('is negative once the event has passed', () => {
		expect(daysBetween('2026-11-29', '2026-11-28')).toBe(-1);
	});

	it('crosses a leap day without drifting', () => {
		expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
	});

	it('is zero exactly on the day, whatever the date', () => {
		fc.assert(
			fc.property(
				fc.date({ min: new Date('2020-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
				(date) => {
					const iso = date.toISOString().slice(0, 10);
					expect(daysBetween(iso, iso)).toBe(0);
				}
			)
		);
	});

	it('is antisymmetric: swapping the dates flips the sign', () => {
		const day = fc.date({
			min: new Date('2020-01-01'),
			max: new Date('2100-01-01'),
			noInvalidDate: true
		});
		fc.assert(
			fc.property(day, day, (a, b) => {
				const [from, to] = [a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)];
				// A sum of zero, not a negated value: swapping equal dates would give -0.
				expect(daysBetween(from, to) + daysBetween(to, from)).toBe(0);
			})
		);
	});
});

describe('stageFor', () => {
	it.each([
		['2026-10-29', 'd30'],
		['2026-11-21', 'd7']
	])('%s before the event is the %s stage', (runDate, stage) => {
		expect(stageFor(runDate, '2026-11-28')).toBe(stage);
	});

	it.each(['2026-10-28', '2026-10-30', '2026-11-20', '2026-11-22', '2026-11-28', '2026-12-01'])(
		'%s is not a reminder day',
		(runDate) => {
			expect(stageFor(runDate, '2026-11-28')).toBeNull();
		}
	);

	it('picks a stage on exactly two days of the year before the event', () => {
		const eventDate = '2026-11-28';
		const days = Array.from({ length: 365 }, (_, index) =>
			new Date(Date.parse(`${eventDate}T00:00:00Z`) - index * 86_400_000).toISOString().slice(0, 10)
		);
		expect(days.filter((day) => stageFor(day, eventDate) !== null)).toEqual([
			'2026-11-21',
			'2026-10-29'
		]);
	});
});

describe('todayAt', () => {
	it('reads the date at the venue, not in UTC', () => {
		// 22:30 UTC is already the next day in Astrakhan.
		expect(todayAt(new Date('2026-10-28T22:30:00Z'), '+04:00')).toBe('2026-10-29');
	});

	it('handles a negative offset', () => {
		expect(todayAt(new Date('2026-10-29T02:00:00Z'), '-05:00')).toBe('2026-10-28');
	});

	it('handles an offset with minutes', () => {
		expect(todayAt(new Date('2026-10-28T18:45:00Z'), '+05:30')).toBe('2026-10-29');
	});
});
