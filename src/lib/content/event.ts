import type { ContentData } from './schema';

type EventTime = Pick<ContentData['event'], 'date' | 'time' | 'utcOffset'>;

// An absolute instant: without the offset the browser would read the time in the guest's zone.
export function eventStart({ date, time, utcOffset }: EventTime): string {
	return `${date}T${time}:00${utcOffset}`;
}

// The month in words for the date plate, from the list in the content config.
export function monthName(date: string, months: ContentData['ui']['months']): string {
	const [, month = ''] = date.split('-');
	return months[Number(month) - 1] ?? '';
}

// Day, month and year as printed on the date plate: 28, 11, 2026.
export function dateParts(date: string): [day: string, month: string, year: string] {
	const [year = '', month = '', day = ''] = date.split('-');
	return [day, month, year];
}
