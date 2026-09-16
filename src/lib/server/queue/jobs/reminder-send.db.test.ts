import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createDb } from '$lib/server/db';
import { guests, parties, reminders, rsvps } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { TelegramError } from '$lib/server/telegram/client';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import { reminderSendJobSchema, type AttendStatus, type ReminderStage } from '$lib/types';
import { InvalidPayloadError } from '../errors';
import { handleReminderSend } from './reminder-send';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

let telegram: FakeTelegramClient;
let deps: { db: typeof db; telegram: FakeTelegramClient };

beforeEach(() => {
	telegram = new FakeTelegramClient();
	deps = { db, telegram };
});

let chatSeq = 600_000;

async function newGuest(
	options: { bound?: boolean; isPlusOne?: boolean; attending?: AttendStatus } = {}
) {
	const suffix = randomUUID().slice(0, 8);
	const [party] = await db
		.insert(parties)
		.values({ title: `Отправка ${suffix}`, audience: 'friends' })
		.returning({ id: parties.id });
	const chatId = options.bound === false ? null : ++chatSeq;
	// A companion belongs to an inviter, so the fixture keeps invariant 1 of tech.md section 4.
	const invitedByGuestId = options.isPlusOne ? await inviterIn(party!.id, suffix) : null;
	const [guest] = await db
		.insert(guests)
		.values({
			partyId: party!.id,
			firstName: 'Нина',
			lastName: `Гостева${suffix}`,
			displayName: `Нина${suffix}`,
			nameKey: nameKey(`Нина Гостева${suffix}`),
			isPlusOne: options.isPlusOne ?? false,
			invitedByGuestId,
			telegramChatId: chatId,
			botToken: randomUUID()
		})
		.returning({ id: guests.id });
	if (options.attending) {
		await db
			.insert(rsvps)
			.values({ guestId: guest!.id, attending: options.attending, source: 'web' });
	}
	return { guestId: guest!.id, chatId, displayName: `Нина${suffix}` };
}

async function inviterIn(partyId: string, suffix: string): Promise<string> {
	const [inviter] = await db
		.insert(guests)
		.values({
			partyId,
			firstName: 'Павел',
			lastName: `Гостев${suffix}`,
			displayName: 'Павел',
			nameKey: nameKey(`Павел Гостев${suffix}`),
			botToken: randomUUID()
		})
		.returning({ id: guests.id });
	return inviter!.id;
}

async function reminderRow(guestId: string, stage: ReminderStage) {
	const [row] = await db
		.select()
		.from(reminders)
		.where(and(eq(reminders.guestId, guestId), eq(reminders.stage, stage)));
	return row;
}

describe('reminder.send handler', () => {
	it('writes to the guest chat and records the reminder as sent', async () => {
		const { guestId, chatId } = await newGuest({ attending: 'yes' });

		await expect(handleReminderSend(deps, { guestId, stage: 'd30' })).resolves.toBe('sent');

		expect(telegram.sent).toHaveLength(1);
		expect(telegram.sent[0]).toMatchObject({ chatId });
		expect(await reminderRow(guestId, 'd30')).toMatchObject({ status: 'sent', error: null });
	});

	it.each([
		['no answer yet', undefined, 'ждём вашего ответа'],
		['a yes', 'yes', 'Ждём вас'],
		['a no', 'no', 'прийти не получится']
	] as const)('picks the template for %s', async (_, attending, expected) => {
		const { guestId } = await newGuest(attending ? { attending } : {});

		await handleReminderSend(deps, { guestId, stage: 'd7' });

		expect(telegram.sent[0]?.text).toContain(expected);
	});

	it('names the stage in the text', async () => {
		const first = await newGuest({ attending: 'yes' });
		const second = await newGuest({ attending: 'yes' });

		await handleReminderSend(deps, { guestId: first.guestId, stage: 'd30' });
		await handleReminderSend(deps, { guestId: second.guestId, stage: 'd7' });

		expect(telegram.sent[0]?.text).toContain('месяц');
		expect(telegram.sent[1]?.text).toContain('неделя');
	});

	it('is idempotent: two runs with the same payload give exactly one message', async () => {
		const { guestId } = await newGuest({ attending: 'yes' });
		const payload = { guestId, stage: 'd30' } as const;

		await handleReminderSend(deps, payload);
		await expect(handleReminderSend(deps, payload)).resolves.toBe('duplicate');

		expect(telegram.sent).toHaveLength(1);
	});

	it('is idempotent under concurrent runs', async () => {
		const { guestId } = await newGuest({ attending: 'yes' });
		const payload = { guestId, stage: 'd7' } as const;

		const outcomes = await Promise.all([
			handleReminderSend(deps, payload),
			handleReminderSend(deps, payload)
		]);

		expect(outcomes.sort()).toEqual(['duplicate', 'sent']);
		expect(telegram.sent).toHaveLength(1);
	});

	it('sends the other stage to the same guest', async () => {
		const { guestId } = await newGuest({ attending: 'yes' });

		await handleReminderSend(deps, { guestId, stage: 'd30' });
		await handleReminderSend(deps, { guestId, stage: 'd7' });

		expect(telegram.sent).toHaveLength(2);
	});

	it('never writes to a companion', async () => {
		const { guestId } = await newGuest({ isPlusOne: true, attending: 'yes' });

		await expect(handleReminderSend(deps, { guestId, stage: 'd30' })).resolves.toBe('skipped');

		expect(telegram.sent).toHaveLength(0);
		expect(await reminderRow(guestId, 'd30')).toMatchObject({ status: 'skipped' });
	});

	it('skips a guest who never started the bot', async () => {
		const { guestId } = await newGuest({ bound: false, attending: 'yes' });

		await expect(handleReminderSend(deps, { guestId, stage: 'd30' })).resolves.toBe('skipped');

		expect(telegram.sent).toHaveLength(0);
		expect(await reminderRow(guestId, 'd30')).toMatchObject({ status: 'skipped' });
	});

	it('does not send again after a skip', async () => {
		const { guestId } = await newGuest({ bound: false });

		await handleReminderSend(deps, { guestId, stage: 'd30' });
		await expect(handleReminderSend(deps, { guestId, stage: 'd30' })).resolves.toBe('duplicate');

		expect(telegram.sent).toHaveLength(0);
	});

	it.each(['server', 'timeout'] as const)(
		'records a %s error as failed and rethrows, so the queue retries',
		async (kind) => {
			const { guestId } = await newGuest({ attending: 'yes' });
			telegram.failNext(kind);

			const error = await handleReminderSend(deps, { guestId, stage: 'd30' }).catch(
				(e: unknown) => e
			);

			expect(error).toBeInstanceOf(TelegramError);
			expect((error as TelegramError).kind).toBe(kind);
			const row = await reminderRow(guestId, 'd30');
			expect(row?.status).toBe('failed');
			expect(row?.error).toContain(kind);
		}
	);

	it('claims a failed reminder again, so the retry reaches the guest exactly once', async () => {
		const { guestId } = await newGuest({ attending: 'yes' });
		telegram.failNext('server');
		await handleReminderSend(deps, { guestId, stage: 'd30' }).catch(() => null);

		await expect(handleReminderSend(deps, { guestId, stage: 'd30' })).resolves.toBe('sent');
		await expect(handleReminderSend(deps, { guestId, stage: 'd30' })).resolves.toBe('duplicate');

		expect(telegram.sent).toHaveLength(1);
		expect(await reminderRow(guestId, 'd30')).toMatchObject({ status: 'sent', error: null });
	});

	it('records a rejected error as failed: the worker cancels the job without retrying', async () => {
		const { guestId } = await newGuest({ attending: 'yes' });
		telegram.failNext('rejected');

		await expect(handleReminderSend(deps, { guestId, stage: 'd7' })).rejects.toMatchObject({
			kind: 'rejected'
		});

		expect(await reminderRow(guestId, 'd7')).toMatchObject({ status: 'failed' });
	});

	it('skips a guest who is gone', async () => {
		const { guestId } = await newGuest({ attending: 'yes' });
		await db.delete(guests).where(eq(guests.id, guestId));

		// The reminders row went with the guest, so nothing is left to claim or to write to.
		await expect(handleReminderSend(deps, { guestId, stage: 'd30' })).rejects.toThrow();
		expect(telegram.sent).toHaveLength(0);
	});

	it('accepts the payload the scheduler builds', async () => {
		const { guestId } = await newGuest({ attending: 'yes' });
		const job = { guestId, stage: 'd30' as const };

		expect(reminderSendJobSchema.parse(job)).toEqual(job);
		await expect(handleReminderSend(deps, job)).resolves.toBe('sent');
	});

	it.each([
		['a missing guestId', { stage: 'd30' }],
		['a guestId that is not a uuid', { guestId: 'g-1', stage: 'd30' }],
		['an unknown stage', { guestId: randomUUID(), stage: 'd14' }],
		['a missing stage', { guestId: randomUUID() }],
		['a null payload', null]
	])('rejects %s without sending', async (_, payload) => {
		await expect(handleReminderSend(deps, payload)).rejects.toBeInstanceOf(InvalidPayloadError);
		expect(telegram.sent).toHaveLength(0);
	});
});
