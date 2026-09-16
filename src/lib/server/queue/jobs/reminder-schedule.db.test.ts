import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createDb } from '$lib/server/db';
import { guests, jobReceipts, parties } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { reminderScheduleJobSchema, type ReminderStage } from '$lib/types';
import { InvalidPayloadError } from '../errors';
import { REMINDER_SCHEDULE, handleReminderSchedule } from './reminder-schedule';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

const DAY_MS = 86_400_000;

// Every test gets its own run date, so one test's receipt never makes the next one a duplicate.
let dateSeq = 0;
function nextRunDate(): string {
	return new Date(Date.parse('2030-01-01T00:00:00Z') + dateSeq++ * DAY_MS)
		.toISOString()
		.slice(0, 10);
}

const plusDays = (date: string, days: number) =>
	new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

let queued: { guestId: string; stage: ReminderStage }[];

beforeEach(() => {
	queued = [];
});

/**
 * Deps whose event date puts `runDate` exactly `daysAhead` days before the wedding, which is what
 * decides the stage. `daysAhead: null` builds a plain day with no reminder due.
 */
function deps(runDate: string, daysAhead: number | null) {
	return {
		db,
		event: { date: plusDays(runDate, daysAhead ?? 100) },
		sendReminder: async (guestId: string, stage: ReminderStage) => {
			queued.push({ guestId, stage });
		}
	};
}

let chatSeq = 500_000;

async function newGuest(options: { bound?: boolean; isPlusOne?: boolean } = {}) {
	const suffix = randomUUID().slice(0, 8);
	const [party] = await db
		.insert(parties)
		.values({ title: `Напоминания ${suffix}`, audience: 'friends' })
		.returning({ id: parties.id });
	// A companion belongs to an inviter, so the fixture keeps invariant 1 of tech.md section 4.
	const invitedByGuestId = options.isPlusOne ? await inviterIn(party!.id, suffix) : null;
	const [guest] = await db
		.insert(guests)
		.values({
			partyId: party!.id,
			firstName: 'Игорь',
			lastName: `Ждунов${suffix}`,
			displayName: 'Игорь',
			nameKey: nameKey(`Игорь Ждунов${suffix}`),
			isPlusOne: options.isPlusOne ?? false,
			invitedByGuestId,
			telegramChatId: options.bound === false ? null : ++chatSeq,
			botToken: randomUUID()
		})
		.returning({ id: guests.id });
	return guest!.id;
}

async function inviterIn(partyId: string, suffix: string): Promise<string> {
	const [inviter] = await db
		.insert(guests)
		.values({
			partyId,
			firstName: 'Лариса',
			lastName: `Ждунова${suffix}`,
			displayName: 'Лариса',
			nameKey: nameKey(`Лариса Ждунова${suffix}`),
			botToken: randomUUID()
		})
		.returning({ id: guests.id });
	return inviter!.id;
}

const queuedFor = (guestId: string) => queued.filter((job) => job.guestId === guestId);

async function receiptExists(runDate: string) {
	const key = `${REMINDER_SCHEDULE}:${runDate}`;
	return (await db.select().from(jobReceipts).where(eq(jobReceipts.key, key))).length === 1;
}

describe('reminder.schedule handler', () => {
	it('queues a d30 send for a bound guest 30 days before the event', async () => {
		const guestId = await newGuest();
		const runDate = nextRunDate();

		await expect(handleReminderSchedule(deps(runDate, 30), { runDate })).resolves.toBe('queued');

		expect(queuedFor(guestId)).toEqual([{ guestId, stage: 'd30' }]);
	});

	it('queues a d7 send 7 days before the event', async () => {
		const guestId = await newGuest();
		const runDate = nextRunDate();

		await handleReminderSchedule(deps(runDate, 7), { runDate });

		expect(queuedFor(guestId)).toEqual([{ guestId, stage: 'd7' }]);
	});

	it('queues nothing on any other day, and writes no receipt', async () => {
		await newGuest();
		const runDate = nextRunDate();

		await expect(handleReminderSchedule(deps(runDate, null), { runDate })).resolves.toBe('skipped');

		expect(queued).toHaveLength(0);
		expect(await receiptExists(runDate)).toBe(false);
	});

	it('leaves out a guest who never started the bot', async () => {
		const guestId = await newGuest({ bound: false });
		const runDate = nextRunDate();

		await handleReminderSchedule(deps(runDate, 30), { runDate });

		expect(queuedFor(guestId)).toHaveLength(0);
	});

	it('leaves out a companion, even one with a bound chat', async () => {
		const guestId = await newGuest({ isPlusOne: true });
		const runDate = nextRunDate();

		await handleReminderSchedule(deps(runDate, 30), { runDate });

		expect(queuedFor(guestId)).toHaveLength(0);
	});

	it('is idempotent: two runs with the same payload queue one set of sends', async () => {
		const guestId = await newGuest();
		const runDate = nextRunDate();

		await handleReminderSchedule(deps(runDate, 30), { runDate });
		const first = queuedFor(guestId).length;
		await expect(handleReminderSchedule(deps(runDate, 30), { runDate })).resolves.toBe('duplicate');

		expect(first).toBe(1);
		expect(queuedFor(guestId)).toHaveLength(1);
		expect(await receiptExists(runDate)).toBe(true);
	});

	it('is idempotent under concurrent runs', async () => {
		const guestId = await newGuest();
		const runDate = nextRunDate();

		const outcomes = await Promise.all([
			handleReminderSchedule(deps(runDate, 7), { runDate }),
			handleReminderSchedule(deps(runDate, 7), { runDate })
		]);

		expect(outcomes.sort()).toEqual(['duplicate', 'queued']);
		expect(queuedFor(guestId)).toHaveLength(1);
	});

	it('rolls the receipt back when queueing fails, so a retry runs the day again', async () => {
		const guestId = await newGuest();
		const runDate = nextRunDate();
		const failing = {
			...deps(runDate, 30),
			sendReminder: async (id: string) => {
				if (id === guestId) throw new Error('queue is down');
			}
		};

		await expect(handleReminderSchedule(failing, { runDate })).rejects.toThrow('queue is down');
		expect(await receiptExists(runDate)).toBe(false);

		await expect(handleReminderSchedule(deps(runDate, 30), { runDate })).resolves.toBe('queued');
		expect(queuedFor(guestId)).toEqual([{ guestId, stage: 'd30' }]);
	});

	it('queues jobs the reminder.send schema accepts', async () => {
		const guestId = await newGuest();
		const runDate = nextRunDate();

		await handleReminderSchedule(deps(runDate, 30), { runDate });

		expect(reminderScheduleJobSchema.parse({ runDate })).toEqual({ runDate });
		expect(queuedFor(guestId)).toEqual([{ guestId, stage: 'd30' }]);
	});

	it.each([
		['a missing runDate', {}],
		['a runDate that is not a date', { runDate: 'tomorrow' }],
		['a runDate with a time', { runDate: '2026-10-29T07:00:00Z' }],
		['an impossible calendar day', { runDate: '2026-02-30' }],
		['a null payload', null]
	])('rejects %s without queueing', async (_, payload) => {
		await expect(handleReminderSchedule(deps(nextRunDate(), 30), payload)).rejects.toBeInstanceOf(
			InvalidPayloadError
		);
		expect(queued).toHaveLength(0);
	});
});
