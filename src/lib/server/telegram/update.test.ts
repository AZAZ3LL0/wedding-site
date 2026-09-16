import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { incoming, parseCommand, telegramUpdateSchema } from './update';

const message = (text: string, chatId = 42, type = 'private') => ({
	update_id: 1,
	message: { message_id: 7, chat: { id: chatId, type }, text }
});

describe('telegramUpdateSchema', () => {
	it('accepts a private text message and keeps what the bot reads', () => {
		const parsed = telegramUpdateSchema.parse(message('/start abc'));

		expect(parsed.message?.chat).toMatchObject({ id: 42, type: 'private' });
		expect(parsed.message?.text).toBe('/start abc');
	});

	it('accepts an update the bot has no handler for, so Telegram gets its 200', () => {
		const parsed = telegramUpdateSchema.parse({ update_id: 9, callback_query: { id: 'q' } });

		expect(parsed.message).toBeUndefined();
	});

	it.each([
		['no update_id', { message: { chat: { id: 1, type: 'private' } } }],
		['a string update_id', { update_id: 'one' }],
		['a chat without an id', { update_id: 1, message: { chat: { type: 'private' } } }],
		['a chat id that is not a number', { update_id: 1, message: { chat: { id: '1', type: 'x' } } }],
		['a null body', null],
		['an array body', []]
	])('rejects %s', (_, raw) => {
		expect(telegramUpdateSchema.safeParse(raw).success).toBe(false);
	});
});

describe('parseCommand', () => {
	it('splits the command from its argument', () => {
		expect(parseCommand('/start my-token')).toEqual({ command: 'start', argument: 'my-token' });
	});

	it('drops the bot mention Telegram adds in groups', () => {
		expect(parseCommand('/start@wedding_bot tok')).toEqual({ command: 'start', argument: 'tok' });
	});

	it('lower-cases the command so /Start works too', () => {
		expect(parseCommand('/ADDRESS')).toEqual({ command: 'address', argument: '' });
	});

	it.each(['', 'hello', 'start', '/ ', '/  token', '/пример'])('reads %j as no command', (text) => {
		expect(parseCommand(text)).toBeNull();
	});

	it('never returns an argument with surrounding whitespace', () => {
		fc.assert(
			fc.property(fc.string({ minLength: 1, maxLength: 20 }), (raw) => {
				const parsed = parseCommand(`/start   ${raw}   `);
				expect(parsed?.argument).toBe(parsed?.argument.trim());
			})
		);
	});
});

describe('incoming', () => {
	it('reads a command out of a private message', () => {
		expect(incoming(message('/address'))).toEqual({
			chatId: 42,
			command: { command: 'address', argument: '' }
		});
	});

	it('ignores a group chat: the bot answers one guest about their own answer', () => {
		expect(incoming(message('/address', 42, 'supergroup'))).toBeNull();
	});

	it('ignores a message that is not a command', () => {
		expect(incoming(message('привет'))).toBeNull();
	});

	it('ignores an update without a message', () => {
		expect(incoming(telegramUpdateSchema.parse({ update_id: 3 }))).toBeNull();
	});
});
