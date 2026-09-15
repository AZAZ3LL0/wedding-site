import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { createDb } from '$lib/server/db';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import { startQueue, type Queue } from './boss';
import { DEMO_PING } from './jobs/demo-ping';
import { RSVP_NOTIFY_ADMIN } from './jobs/rsvp-notify-admin';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';

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

	it('notifies the admin about an answer once per saved state, even when queued twice', async () => {
		const lastName = `Ответов${randomUUID().slice(0, 8)}`;
		const [party] = await db
			.insert(parties)
			.values({ title: 'Очередь', audience: 'friends' })
			.returning({ id: parties.id });
		const [guest] = await db
			.insert(guests)
			.values({
				partyId: party!.id,
				firstName: 'Олег',
				lastName,
				displayName: 'Олег',
				nameKey: nameKey(`Олег ${lastName}`),
				botToken: randomUUID()
			})
			.returning({ id: guests.id });
		const [answer] = await db
			.insert(rsvps)
			.values({ guestId: guest!.id, attending: 'yes', source: 'web' })
			.returning({ updatedAt: rsvps.updatedAt });
		const job = {
			guestId: guest!.id,
			kind: 'created' as const,
			updatedAt: answer!.updatedAt.toISOString()
		};

		const [first, second] = await Promise.all([
			queue.sendRsvpNotifyAdmin(job),
			queue.sendRsvpNotifyAdmin(job)
		]);

		const id = first ?? second;
		expect([first, second].filter(Boolean)).toHaveLength(1);
		await vi.waitFor(async () => {
			const state = (await queue.boss.getJobById(RSVP_NOTIFY_ADMIN, id as string))?.state;
			expect(state).toBe('completed');
		}, settle);
		expect(telegram.sent.filter((m) => m.text.includes(lastName))).toHaveLength(1);
	});
});
