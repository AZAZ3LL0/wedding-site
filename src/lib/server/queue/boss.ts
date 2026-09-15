import { PgBoss, type Job } from 'pg-boss';
import { getConfig } from '$lib/server/config';
import { getDb, type Db } from '$lib/server/db';
import { getTelegramClient } from '$lib/server/telegram';
import { TelegramError, type TelegramClient } from '$lib/server/telegram/client';
import { InvalidPayloadError } from './errors';
import { DEMO_PING, handleDemoPing } from './jobs/demo-ping';
import { UNKNOWN_NOTIFY_ADMIN, handleUnknownNotifyAdmin } from './jobs/unknown-notify-admin';

export type QueueDeps = {
	connectionString: string;
	db: Db;
	telegram: TelegramClient;
	adminChatId: number;
	// Tests shorten these so retries settle in seconds.
	pollingIntervalSeconds?: number;
	retryDelaySeconds?: number;
};

export type Queue = {
	boss: PgBoss;
	sendDemoPing(pingId?: string): Promise<string | null>;
	sendUnknownNotifyAdmin(requestId: string): Promise<string | null>;
	stop(): Promise<void>;
};

// Retrying cannot fix these, so the job is cancelled instead of failing retryLimit more times.
function isPermanent(error: unknown): boolean {
	return (
		error instanceof InvalidPayloadError ||
		(error instanceof TelegramError && error.kind === 'rejected')
	);
}

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
	await boss.createQueue(DEMO_PING, { ...retry, policy: 'stately' });
	await boss.createQueue(UNKNOWN_NOTIFY_ADMIN, { ...retry, policy: 'stately' });

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
	await boss.work<unknown>(DEMO_PING, polling, async ([job]) => {
		if (job) await run(job, () => handleDemoPing(deps, job.data));
	});
	await boss.work<unknown>(UNKNOWN_NOTIFY_ADMIN, polling, async ([job]) => {
		if (job) await run(job, () => handleUnknownNotifyAdmin(deps, job.data));
	});

	return {
		boss,
		sendDemoPing: (pingId = crypto.randomUUID()) =>
			boss.send(DEMO_PING, { pingId }, { ...retry, singletonKey: pingId }),
		sendUnknownNotifyAdmin: (requestId) =>
			boss.send(UNKNOWN_NOTIFY_ADMIN, { requestId }, { ...retry, singletonKey: requestId }),
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
