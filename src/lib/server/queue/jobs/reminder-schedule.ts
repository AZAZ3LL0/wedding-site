import type { ContentData } from '$lib/content/schema';
import type { Db } from '$lib/server/db';
import { listReminderTargets } from '$lib/server/telegram/repo';
import { reminderScheduleJobSchema, type ReminderStage } from '$lib/types';
import { InvalidPayloadError } from '../errors';
import { withReceipt } from '../repo';

export const REMINDER_SCHEDULE = 'reminder.schedule';

const DAY_MS = 24 * 60 * 60 * 1000;

// The stages tech.md §5 fixes: a reminder goes out exactly 30 and exactly 7 days before.
const STAGES: Record<number, ReminderStage> = { 30: 'd30', 7: 'd7' };

// Calendar days between two ISO dates. Both are read at UTC midnight, so no offset can shift one
// of them into the neighbouring day and turn 30 into 29.
export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function stageFor(runDate: string, eventDate: string): ReminderStage | null {
	return STAGES[daysBetween(runDate, eventDate)] ?? null;
}

// The cron fires with a fixed payload, so the run date is filled in here, at the composition root.
export function todayAt(now: Date, utcOffset: string): string {
	return new Date(now.getTime() + offsetMs(utcOffset)).toISOString().slice(0, 10);
}

function offsetMs(utcOffset: string): number {
	const [sign, hours, minutes] = [
		utcOffset.startsWith('-') ? -1 : 1,
		Number(utcOffset.slice(1, 3)),
		Number(utcOffset.slice(4, 6))
	];
	return sign * (hours * 60 + minutes) * 60 * 1000;
}

export type ReminderScheduleDeps = {
	db: Db;
	event: Pick<ContentData['event'], 'date'>;
	sendReminder: (guestId: string, stage: ReminderStage) => Promise<void>;
};

export type ScheduleOutcome = 'queued' | 'skipped' | 'duplicate';

/**
 * Queues one `reminder.send` per bound guest on the two days that matter (tech.md §5).
 * Companions are left out by the query: the bot never writes to them.
 */
export async function handleReminderSchedule(
	deps: ReminderScheduleDeps,
	data: unknown
): Promise<ScheduleOutcome> {
	const parsed = reminderScheduleJobSchema.safeParse(data);
	if (!parsed.success) {
		throw new InvalidPayloadError(
			REMINDER_SCHEDULE,
			parsed.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`)
		);
	}
	const { runDate } = parsed.data;

	const stage = stageFor(runDate, deps.event.date);
	if (!stage) return 'skipped';

	const outcome = await withReceipt(deps.db, `${REMINDER_SCHEDULE}:${runDate}`, async () => {
		for (const guestId of await listReminderTargets(deps.db)) {
			await deps.sendReminder(guestId, stage);
		}
	});
	return outcome === 'done' ? 'queued' : 'duplicate';
}
