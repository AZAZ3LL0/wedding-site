import { PgBoss, type Job } from 'pg-boss';
import type { Db } from '$lib/server/db';
import { TelegramError, type TelegramClient } from '$lib/server/telegram/client';
import { InvalidPayloadError } from './errors';
import { DEMO_PING, handleDemoPing } from './jobs/demo-ping';

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

	const run = async (job: Job<unknown>, handler: () => Promise<unknown>) => {
		try {
			await handler();
		} catch (error) {
			if (!isPermanent(error)) throw error;
			console.error(`[queue] ${job.name} ${job.id} cancelled:`, (error as Error).message);
			await boss.cancel(job.name, job.id);
		}
	};

	await boss.work<unknown>(
		DEMO_PING,
		{ pollingIntervalSeconds: deps.pollingIntervalSeconds ?? 2 },
		async ([job]) => {
			if (job) await run(job, () => handleDemoPing(deps, job.data));
		}
	);

	return {
		boss,
		sendDemoPing: (pingId = crypto.randomUUID()) =>
			boss.send(DEMO_PING, { pingId }, { ...retry, singletonKey: pingId }),
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
