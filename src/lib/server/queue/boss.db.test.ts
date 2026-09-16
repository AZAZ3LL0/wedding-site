import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { createDb } from '$lib/server/db';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import { startQueue, type Queue } from './boss';
import { REMINDER_SCHEDULE } from './jobs/reminder-schedule';
import { REMINDER_SEND } from './jobs/reminder-send';
import { RSVP_NOTIFY_ADMIN } from './jobs/rsvp-notify-admin';

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

let chatSeq = 700_000;

// A guest the reminder worker can actually write to: bound chat, not a companion.
async function boundGuest() {
	const lastName = `Очередев${randomUUID().slice(0, 8)}`;
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
			displayName: lastName,
			nameKey: nameKey(`Олег ${lastName}`),
			telegramChatId: ++chatSeq,
			botToken: randomUUID()
		})
		.returning({ id: guests.id });
	return { guestId: guest!.id, displayName: lastName };
}

function messagesFor(displayName: string) {
	return telegram.sent.filter((m) => m.text.includes(displayName));
}

async function stateOf(topic: string, id: string | null) {
	expect(id).not.toBeNull();
	return (await queue.boss.getJobById(topic, id as string))?.state;
}

describe('pg-boss wiring', () => {
	it('runs a reminder end to end', async () => {
		const { guestId, displayName } = await boundGuest();

		const id = await queue.sendReminderSend({ guestId, stage: 'd30' });

		await vi.waitFor(
			async () => expect(await stateOf(REMINDER_SEND, id)).toBe('completed'),
			settle
		);
		expect(messagesFor(displayName)).toHaveLength(1);
	});

	it('does not queue a second job while the first is still pending', async () => {
		const { guestId, displayName } = await boundGuest();
		const job = { guestId, stage: 'd30' } as const;

		const [first, second] = await Promise.all([
			queue.sendReminderSend(job),
			queue.sendReminderSend(job)
		]);

		expect([first, second].filter(Boolean)).toHaveLength(1);
		await vi.waitFor(
			async () => expect(await stateOf(REMINDER_SEND, first ?? second)).toBe('completed'),
			settle
		);
		expect(messagesFor(displayName)).toHaveLength(1);
	});

	it('retries a server error and delivers exactly once', async () => {
		const { guestId, displayName } = await boundGuest();
		telegram.failNext('server');

		const id = await queue.sendReminderSend({ guestId, stage: 'd7' });

		await vi.waitFor(
			async () => expect(await stateOf(REMINDER_SEND, id)).toBe('completed'),
			settle
		);
		expect((await queue.boss.getJobById(REMINDER_SEND, id as string))?.retryCount).toBe(1);
		expect(messagesFor(displayName)).toHaveLength(1);
	});

	it('fails an invalid payload without retrying', async () => {
		const id = await queue.boss.send(REMINDER_SEND, { guestId: 'not-a-uuid', stage: 'd30' });

		await vi.waitFor(
			async () => expect(await stateOf(REMINDER_SEND, id)).toBe('cancelled'),
			settle
		);
		expect((await queue.boss.getJobById(REMINDER_SEND, id as string))?.retryCount).toBe(0);
	});

	it('fails a rejected Telegram error without retrying', async () => {
		const { guestId, displayName } = await boundGuest();
		telegram.failNext('rejected');

		const id = await queue.sendReminderSend({ guestId, stage: 'd30' });

		await vi.waitFor(
			async () => expect(await stateOf(REMINDER_SEND, id)).toBe('cancelled'),
			settle
		);
		expect((await queue.boss.getJobById(REMINDER_SEND, id as string))?.retryCount).toBe(0);
		expect(messagesFor(displayName)).toHaveLength(0);
	});

	it('notifies the admin about an answer once per saved state, even when queued twice', async () => {
		const { guestId, displayName } = await boundGuest();
		const [answer] = await db
			.insert(rsvps)
			.values({ guestId, attending: 'yes', source: 'web' })
			.returning({ updatedAt: rsvps.updatedAt });
		const job = {
			guestId,
			kind: 'created' as const,
			updatedAt: answer!.updatedAt.toISOString()
		};

		const [first, second] = await Promise.all([
			queue.sendRsvpNotifyAdmin(job),
			queue.sendRsvpNotifyAdmin(job)
		]);

		expect([first, second].filter(Boolean)).toHaveLength(1);
		await vi.waitFor(
			async () => expect(await stateOf(RSVP_NOTIFY_ADMIN, first ?? second)).toBe('completed'),
			settle
		);
		expect(messagesFor(displayName)).toHaveLength(1);
	});

	it('schedules a send for every bound guest on the day the reminder is due', async () => {
		const { displayName } = await boundGuest();

		// 30 days before the event date in the content config, so this run is the d30 stage.
		const id = await queue.sendReminderSchedule({ runDate: '2026-10-29' });

		await vi.waitFor(
			async () => expect(await stateOf(REMINDER_SCHEDULE, id)).toBe('completed'),
			settle
		);
		await vi.waitFor(async () => expect(messagesFor(displayName)).toHaveLength(1), settle);
	});
});
