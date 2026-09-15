import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '$lib/server/db';
import { jobReceipts, unknownRequests } from '$lib/server/db/schema';
import { insertUnknownRequest } from '$lib/server/guests/repo';
import { TelegramError } from '$lib/server/telegram/client';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import { InvalidPayloadError } from '../errors';
import { handleUnknownNotifyAdmin } from './unknown-notify-admin';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

const adminChatId = -100700;

function setup() {
	const telegram = new FakeTelegramClient();
	return { telegram, deps: { db, telegram, adminChatId } };
}

async function newRequest(contact: string | null = '@stranger') {
	const rawName = `Гость ${randomUUID().slice(0, 8)}`;
	const requestId = await insertUnknownRequest(db, { rawName, contact });
	return { rawName, contact, payload: { requestId } };
}

async function receiptExists(requestId: string) {
	const rows = await db
		.select()
		.from(jobReceipts)
		.where(eq(jobReceipts.key, `unknown.notify-admin:${requestId}`));
	return rows.length === 1;
}

describe('unknown.notify-admin handler', () => {
	it('sends the name and contact from the request to the admin chat', async () => {
		const { telegram, deps } = setup();
		const { rawName, payload } = await newRequest('+7 900 111-22-33');

		await expect(handleUnknownNotifyAdmin(deps, payload)).resolves.toBe('sent');

		expect(telegram.sent).toHaveLength(1);
		expect(telegram.sent[0]).toMatchObject({ chatId: adminChatId });
		expect(telegram.sent[0]?.text).toContain(rawName);
		expect(telegram.sent[0]?.text).toContain('+7 900 111-22-33');
	});

	it('still reports a request without a contact', async () => {
		const { telegram, deps } = setup();
		const { rawName, payload } = await newRequest(null);

		await handleUnknownNotifyAdmin(deps, payload);
		expect(telegram.sent[0]?.text).toContain(rawName);
	});

	it('is idempotent: two runs with the same payload give exactly one message', async () => {
		const { telegram, deps } = setup();
		const { payload } = await newRequest();

		await handleUnknownNotifyAdmin(deps, payload);
		await expect(handleUnknownNotifyAdmin(deps, payload)).resolves.toBe('duplicate');

		expect(telegram.sent).toHaveLength(1);
		expect(await receiptExists(payload.requestId)).toBe(true);
	});

	it('is idempotent under concurrent runs', async () => {
		const { telegram, deps } = setup();
		const { payload } = await newRequest();

		const outcomes = await Promise.all([
			handleUnknownNotifyAdmin(deps, payload),
			handleUnknownNotifyAdmin(deps, payload)
		]);

		expect(outcomes.sort()).toEqual(['duplicate', 'sent']);
		expect(telegram.sent).toHaveLength(1);
	});

	it.each(['server', 'timeout', 'rejected'] as const)(
		'a %s error rolls the receipt back, so a retry still sends once',
		async (kind) => {
			const { telegram, deps } = setup();
			const { payload } = await newRequest();
			telegram.failNext(kind);

			const error = await handleUnknownNotifyAdmin(deps, payload).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(TelegramError);
			expect(await receiptExists(payload.requestId)).toBe(false);

			await expect(handleUnknownNotifyAdmin(deps, payload)).resolves.toBe('sent');
			await expect(handleUnknownNotifyAdmin(deps, payload)).resolves.toBe('duplicate');
			expect(telegram.sent).toHaveLength(1);
		}
	);

	it('finishes without a message when the request is gone', async () => {
		const { telegram, deps } = setup();
		const { payload } = await newRequest();
		await db.delete(unknownRequests).where(eq(unknownRequests.id, payload.requestId));

		await expect(handleUnknownNotifyAdmin(deps, payload)).resolves.toBe('missing');
		expect(telegram.sent).toHaveLength(0);
	});

	it.each([
		['a missing requestId', {}],
		['a requestId that is not a uuid', { requestId: 'request-1' }],
		['a null payload', null]
	])('rejects %s without sending', async (_, payload) => {
		const { telegram, deps } = setup();

		await expect(handleUnknownNotifyAdmin(deps, payload)).rejects.toBeInstanceOf(
			InvalidPayloadError
		);
		expect(telegram.sent).toHaveLength(0);
	});
});
