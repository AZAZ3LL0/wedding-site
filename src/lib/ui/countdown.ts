import type { PluralForms } from '$lib/types';

export type DurationParts = { days: number; hours: number; minutes: number; seconds: number };

export function splitDuration(targetMs: number, nowMs: number): DurationParts {
	const left = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
	return {
		days: Math.floor(left / 86_400),
		hours: Math.floor((left % 86_400) / 3_600),
		minutes: Math.floor((left % 3_600) / 60),
		seconds: left % 60
	};
}

// Russian plural rules: 11–14 take the "many" form despite ending in 1–4.
export function pluralForm(n: number, [one, few, many]: PluralForms): string {
	const lastTwo = Math.abs(n) % 100;
	const last = lastTwo % 10;
	if (lastTwo >= 11 && lastTwo <= 14) return many;
	if (last === 1) return one;
	if (last >= 2 && last <= 4) return few;
	return many;
}
