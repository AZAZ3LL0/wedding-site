import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '$lib/server/db';
import { jobReceipts } from '$lib/server/db/schema';
import { TelegramError } from '$lib/server/telegram/client';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import { InvalidPayloadError } from '../errors';
import { handleDemoPing } from './demo-ping';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

const adminChatId = -100500;

function setup() {
	const telegram = new FakeTelegramClient();
	return { telegram, deps: { db, telegram, adminChatId } };
}

async function receiptExists(pingId: string) {
	const rows = await db
		.select()
		.from(jobReceipts)
		.where(eq(jobReceipts.key, `demo.ping:${pingId}`));
	return rows.length === 1;
}

describe('demo.ping handler', () => {
	it('sends one message to the admin chat', async () => {
		const { telegram, deps } = setup();
		const pingId = randomUUID();

		await expect(handleDemoPing(deps, { pingId })).resolves.toBe('sent');

		expect(telegram.sent).toHaveLength(1);
		expect(telegram.sent[0]).toMatchObject({ chatId: adminChatId });
		expect(telegram.sent[0]?.text).toContain(pingId);
	});

	it('is idempotent: two runs with the same payload give exactly one message', async () => {
		const { telegram, deps } = setup();
		const payload = { pingId: randomUUID() };

		await handleDemoPing(deps, payload);
		await expect(handleDemoPing(deps, payload)).resolves.toBe('duplicate');

		expect(telegram.sent).toHaveLength(1);
		expect(await receiptExists(payload.pingId)).toBe(true);
	});

	it('is idempotent under concurrent runs', async () => {
		const { telegram, deps } = setup();
		const payload = { pingId: randomUUID() };

		const outcomes = await Promise.all([
			handleDemoPing(deps, payload),
			handleDemoPing(deps, payload)
		]);

		expect(outcomes.sort()).toEqual(['duplicate', 'sent']);
		expect(telegram.sent).toHaveLength(1);
	});

	it.each(['server', 'timeout', 'rejected'] as const)(
		'a %s error rolls the receipt back, so a retry still sends once',
		async (kind) => {
			const { telegram, deps } = setup();
			const payload = { pingId: randomUUID() };
			telegram.failNext(kind);

			const error = await handleDemoPing(deps, payload).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(TelegramError);
			expect(await receiptExists(payload.pingId)).toBe(false);

			await expect(handleDemoPing(deps, payload)).resolves.toBe('sent');
			await expect(handleDemoPing(deps, payload)).resolves.toBe('duplicate');
			expect(telegram.sent).toHaveLength(1);
		}
	);

	it.each([
		['a missing pingId', {}],
		['a pingId that is not a uuid', { pingId: 'ping-1' }],
		['a null payload', null]
	])('rejects %s without sending', async (_, payload) => {
		const { telegram, deps } = setup();

		await expect(handleDemoPing(deps, payload)).rejects.toBeInstanceOf(InvalidPayloadError);
		expect(telegram.sent).toHaveLength(0);
	});
});
