import { describe, expect, it } from 'vitest';
import { TelegramError } from './client';
import { FakeTelegramClient } from './fake';

describe('FakeTelegramClient', () => {
	it('records a valid message and returns increasing message ids', async () => {
		const client = new FakeTelegramClient();
		const first = await client.sendMessage({ chatId: -100123, text: 'hello' });
		const second = await client.sendMessage({ chatId: 42, text: 'again' });

		expect(second.messageId).toBeGreaterThan(first.messageId);
		expect(client.sent).toMatchObject([
			{ chatId: -100123, text: 'hello', messageId: first.messageId },
			{ chatId: 42, text: 'again', messageId: second.messageId }
		]);
	});

	it.each([
		['a fractional chat id', { chatId: 1.5, text: 'x' }],
		['a string chat id', { chatId: '42', text: 'x' }],
		['empty text', { chatId: 1, text: '' }],
		['text over 4096 characters', { chatId: 1, text: 'x'.repeat(4097) }],
		['a missing text', { chatId: 1 }]
	])('fails loudly on %s and records nothing', async (_, input) => {
		const client = new FakeTelegramClient();
		// @ts-expect-error the fake must also guard against callers that bypass the types
		await expect(client.sendMessage(input)).rejects.toThrow();
		expect(client.sent).toHaveLength(0);
	});

	it('accepts text of exactly 4096 characters', async () => {
		const client = new FakeTelegramClient();
		await client.sendMessage({ chatId: 1, text: 'x'.repeat(4096) });
		expect(client.sent).toHaveLength(1);
	});

	it.each(['server', 'timeout', 'rejected'] as const)(
		'failNext(%s) fails exactly one call with that kind',
		async (kind) => {
			const client = new FakeTelegramClient();
			client.failNext(kind);

			const error = await client.sendMessage({ chatId: 1, text: 'x' }).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(TelegramError);
			expect((error as TelegramError).kind).toBe(kind);
			expect(client.sent).toHaveLength(0);

			await client.sendMessage({ chatId: 1, text: 'x' });
			expect(client.sent).toHaveLength(1);
		}
	);
});
