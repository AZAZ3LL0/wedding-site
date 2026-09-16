import { PgBoss, type Job } from 'pg-boss';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getDb, type Db } from '$lib/server/db';
import { getTelegramClient } from '$lib/server/telegram';
import { TelegramError, type TelegramClient } from '$lib/server/telegram/client';
import type { ReminderScheduleJob, ReminderSendJob, RsvpNotifyAdminJob } from '$lib/types';
import { InvalidPayloadError } from './errors';
import { REMINDER_SCHEDULE, handleReminderSchedule, todayAt } from './jobs/reminder-schedule';
import { REMINDER_SEND, handleReminderSend, reminderSendKey } from './jobs/reminder-send';
import {
	RSVP_NOTIFY_ADMIN,
	handleRsvpNotifyAdmin,
	rsvpNotifyAdminKey
} from './jobs/rsvp-notify-admin';

export type QueueDeps = {
	connectionString: string;
	db: Db;
	telegram: TelegramClient;
	adminChatId: number;
	// Tests shorten these so retries settle in seconds.
	pollingIntervalSeconds?: number;
	retryDelaySeconds?: number;
	// Tests pin the clock the cron run date is read from.
	now?: () => Date;
};

export type Queue = {
	boss: PgBoss;
	sendRsvpNotifyAdmin(job: RsvpNotifyAdminJob): Promise<string | null>;
	sendReminderSchedule(job: ReminderScheduleJob): Promise<string | null>;
	sendReminderSend(job: ReminderSendJob): Promise<string | null>;
	stop(): Promise<void>;
};

// Retrying cannot fix these, so the job is cancelled instead of failing retryLimit more times.
function isPermanent(error: unknown): boolean {
	return (
		error instanceof InvalidPayloadError ||
		(error instanceof TelegramError && error.kind === 'rejected')
	);
}

// 07:00 UTC is 10:00 in Moscow, as tech.md §5 specifies.
const REMINDER_CRON = '0 7 * * *';

export async function startQueue(deps: QueueDeps): Promise<Queue> {
	// pg-boss keeps its tables in the `pgboss` schema of the same database (tech.md §5).
	const boss = new PgBoss({ connectionString: deps.connectionString, schema: 'pgboss', max: 4 });
	boss.on('error', (error) => console.error('[queue]', error.message));
	await boss.start();

	const retry = {
		retryLimit: 3,
		retryBackoff: true,
		retryDelay: deps.retryDelaySeconds ?? 5
	};
	// `stately` makes singletonKey reject a duplicate while the first job is queued or active.
	for (const topic of [RSVP_NOTIFY_ADMIN, REMINDER_SCHEDULE, REMINDER_SEND]) {
		await boss.createQueue(topic, { ...retry, policy: 'stately' });
	}

	const sendReminderSend = (job: ReminderSendJob) =>
		boss.send(REMINDER_SEND, job, { ...retry, singletonKey: reminderSendKey(job) });
	const sendReminderSchedule = (job: ReminderScheduleJob) =>
		boss.send(REMINDER_SCHEDULE, job, {
			...retry,
			singletonKey: `${REMINDER_SCHEDULE}:${job.runDate}`
		});

	const run = async (job: Job<unknown>, handler: () => Promise<unknown>) => {
		try {
			await handler();
		} catch (error) {
			if (!isPermanent(error)) throw error;
			console.error(`[queue] ${job.name} ${job.id} cancelled:`, (error as Error).message);
			await boss.cancel(job.name, job.id);
		}
	};

	const polling = { pollingIntervalSeconds: deps.pollingIntervalSeconds ?? 2 };
	await boss.work<unknown>(RSVP_NOTIFY_ADMIN, polling, async ([job]) => {
		if (job) {
			await run(job, () => handleRsvpNotifyAdmin(deps, job.data));
		}
	});
	await boss.work<unknown>(REMINDER_SCHEDULE, polling, async ([job]) => {
		if (!job) return;
		const event = getContent().event;
		// pg-boss cron carries a fixed payload, so the scheduled run gets its date here.
		const data =
			job.data && typeof job.data === 'object' && 'runDate' in job.data
				? job.data
				: { runDate: todayAt(deps.now?.() ?? new Date(), event.utcOffset) };
		await run(job, () =>
			handleReminderSchedule(
				{
					db: deps.db,
					event,
					sendReminder: async (guestId, stage) => {
						await sendReminderSend({ guestId, stage });
					}
				},
				data
			)
		);
	});
	await boss.work<unknown>(REMINDER_SEND, polling, async ([job]) => {
		if (job) await run(job, () => handleReminderSend(deps, job.data));
	});

	await boss.schedule(REMINDER_SCHEDULE, REMINDER_CRON, {}, retry);

	return {
		boss,
		sendRsvpNotifyAdmin: (job) =>
			boss.send(RSVP_NOTIFY_ADMIN, job, { ...retry, singletonKey: rsvpNotifyAdminKey(job) }),
		sendReminderSchedule,
		sendReminderSend,
		stop: () => boss.stop({ graceful: true, timeout: 5_000 })
	};
}

const globalKey = Symbol.for('wedding.queue');
type WithQueue = typeof globalThis & { [globalKey]?: Promise<Queue> };

// Cached on globalThis: Vite reloads modules in dev, and a second worker would double every job.
export function getQueue(deps: () => QueueDeps): Promise<Queue> {
	const scope = globalThis as WithQueue;
	scope[globalKey] ??= startQueue(deps());
	return scope[globalKey];
}

// The worker every request in this process talks to, wired from app config.
export function getAppQueue(): Promise<Queue> {
	return getQueue(() => {
		const config = getConfig();
		return {
			connectionString: config.databaseUrl,
			db: getDb(),
			telegram: getTelegramClient(),
			adminChatId: config.telegram.adminChatId
		};
	});
}
