import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PluralForms } from '$lib/types';
import { pluralForm, splitDuration } from './countdown';

const days: PluralForms = ['день', 'дня', 'дней'];
const moment = fc.integer({ min: 0, max: 4_102_444_800_000 }); // up to 2100

describe('splitDuration', () => {
	it('recomposes to the whole seconds left and keeps every unit in range', () => {
		fc.assert(
			fc.property(moment, moment, (target, now) => {
				const { days, hours, minutes, seconds } = splitDuration(target, now);
				const left = Math.max(0, Math.floor((target - now) / 1000));
				expect(days * 86_400 + hours * 3_600 + minutes * 60 + seconds).toBe(left);
				expect(hours).toBeLessThan(24);
				expect(minutes).toBeLessThan(60);
				expect(seconds).toBeLessThan(60);
			})
		);
	});

	it('never counts down past zero', () => {
		fc.assert(
			fc.property(moment, fc.nat(), (target, late) => {
				expect(splitDuration(target, target + late)).toEqual({
					days: 0,
					hours: 0,
					minutes: 0,
					seconds: 0
				});
			})
		);
	});

	it('never grows as time passes', () => {
		const total = (p: ReturnType<typeof splitDuration>) =>
			p.days * 86_400 + p.hours * 3_600 + p.minutes * 60 + p.seconds;
		fc.assert(
			fc.property(moment, moment, fc.nat({ max: 10_000_000 }), (target, now, step) => {
				expect(total(splitDuration(target, now + step))).toBeLessThanOrEqual(
					total(splitDuration(target, now))
				);
			})
		);
	});
});

describe('pluralForm', () => {
	it.each([
		[0, 'дней'],
		[1, 'день'],
		[2, 'дня'],
		[4, 'дня'],
		[5, 'дней'],
		[11, 'дней'],
		[12, 'дней'],
		[14, 'дней'],
		[21, 'день'],
		[22, 'дня'],
		[25, 'дней'],
		[101, 'день'],
		[111, 'дней'],
		[112, 'дней'],
		[122, 'дня']
	])('%i → %s', (n, form) => {
		expect(pluralForm(n, days)).toBe(form);
	});

	it('depends only on the last two digits', () => {
		fc.assert(
			fc.property(fc.nat({ max: 1_000_000 }), fc.nat({ max: 1000 }), (n, hundreds) => {
				expect(pluralForm(n + hundreds * 100, days)).toBe(pluralForm(n, days));
			})
		);
	});
});
