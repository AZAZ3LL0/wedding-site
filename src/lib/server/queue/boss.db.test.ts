import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { createDb } from '$lib/server/db';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import { startQueue, type Queue } from './boss';
import { insertUnknownRequest } from '$lib/server/guests/repo';
import { DEMO_PING } from './jobs/demo-ping';
import { UNKNOWN_NOTIFY_ADMIN } from './jobs/unknown-notify-admin';

const databaseUrl = inject('databaseUrl');
const { db, close } = createDb(databaseUrl);
const telegram = new FakeTelegramClient();
let queue: Queue;

beforeAll(async () => {
	queue = await startQueue({
		connectionString: databaseUrl,
		db,
		telegram,
		adminChatId: 7,
		pollingIntervalSeconds: 0.5,
		retryDelaySeconds: 1
	});
});

afterAll(async () => {
	await queue.stop();
	await close();
});

const settle = { timeout: 15_000, interval: 200 };

async function stateOf(id: string | null) {
	expect(id).not.toBeNull();
	return (await queue.boss.getJobById(DEMO_PING, id as string))?.state;
}

function messagesAbout(pingId: string) {
	return telegram.sent.filter((m) => m.text.includes(pingId));
}

describe('pg-boss wiring', () => {
	it('runs a demo ping end to end', async () => {
		const pingId = randomUUID();
		const id = await queue.sendDemoPing(pingId);

		await vi.waitFor(async () => expect(await stateOf(id)).toBe('completed'), settle);
		expect(messagesAbout(pingId)).toHaveLength(1);
	});

	it('does not queue a second job for a ping that is still pending', async () => {
		const pingId = randomUUID();
		const [first, second] = await Promise.all([
			queue.sendDemoPing(pingId),
			queue.sendDemoPing(pingId)
		]);

		expect([first, second].filter(Boolean)).toHaveLength(1);
		await vi.waitFor(async () => expect(await stateOf(first ?? second)).toBe('completed'), settle);
		expect(messagesAbout(pingId)).toHaveLength(1);
	});

	it('retries a server error and delivers exactly once', async () => {
		const pingId = randomUUID();
		telegram.failNext('server');
		const id = await queue.sendDemoPing(pingId);

		await vi.waitFor(async () => expect(await stateOf(id)).toBe('completed'), settle);
		const job = await queue.boss.getJobById(DEMO_PING, id as string);
		expect(job?.retryCount).toBe(1);
		expect(messagesAbout(pingId)).toHaveLength(1);
	});

	it('fails an invalid payload without retrying', async () => {
		const id = await queue.boss.send(DEMO_PING, { pingId: 'not-a-uuid' });

		await vi.waitFor(async () => expect(await stateOf(id)).toBe('cancelled'), settle);
		const job = await queue.boss.getJobById(DEMO_PING, id as string);
		expect(job?.retryCount).toBe(0);
	});

	it('fails a rejected Telegram error without retrying', async () => {
		const pingId = randomUUID();
		telegram.failNext('rejected');
		const id = await queue.sendDemoPing(pingId);

		await vi.waitFor(async () => expect(await stateOf(id)).toBe('cancelled'), settle);
		const job = await queue.boss.getJobById(DEMO_PING, id as string);
		expect(job?.retryCount).toBe(0);
		expect(messagesAbout(pingId)).toHaveLength(0);
	});

	it('notifies the admin about an unknown request once, even when queued twice', async () => {
		const rawName = `Незнакомец ${randomUUID().slice(0, 8)}`;
		const requestId = await insertUnknownRequest(db, { rawName, contact: null });
		const [first, second] = await Promise.all([
			queue.sendUnknownNotifyAdmin(requestId),
			queue.sendUnknownNotifyAdmin(requestId)
		]);

		const id = first ?? second;
		expect([first, second].filter(Boolean)).toHaveLength(1);
		await vi.waitFor(async () => {
			const job = await queue.boss.getJobById(UNKNOWN_NOTIFY_ADMIN, id as string);
			expect(job?.state).toBe('completed');
		}, settle);
		expect(telegram.sent.filter((m) => m.text.includes(rawName))).toHaveLength(1);
	});
});
