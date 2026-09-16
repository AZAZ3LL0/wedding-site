import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { botLink } from './link';

const base = { botUsername: 'kyz_uzatu_bot', botToken: 'abc123', telegramChatId: null };

describe('botLink', () => {
	it('builds the guest personal deep link', () => {
		expect(botLink(base)).toBe('https://t.me/kyz_uzatu_bot?start=abc123');
	});

	it('accepts a username written with the @ the organizer copied', () => {
		expect(botLink({ ...base, botUsername: '@kyz_uzatu_bot' })).toBe(
			'https://t.me/kyz_uzatu_bot?start=abc123'
		);
	});

	it('hides the link from a guest who already started the bot', () => {
		expect(botLink({ ...base, telegramChatId: 100 })).toBeNull();
	});

	it('hides the link while TELEGRAM_BOT_USERNAME is unset', () => {
		expect(botLink({ ...base, botUsername: null })).toBeNull();
	});

	it.each(['bot', 'a'.repeat(33), 'bad name', 'bad-name'])(
		'hides the link for the unusable username %j',
		(botUsername) => {
			expect(botLink({ ...base, botUsername })).toBeNull();
		}
	);

	it.each(['', 'a'.repeat(65), 'has space', 'слово', 'plus+sign'])(
		'hides the link for a token Telegram would drop: %j',
		(botToken) => {
			expect(botLink({ ...base, botToken })).toBeNull();
		}
	);

	it('only ever points at t.me with the token as the start payload', () => {
		fc.assert(
			fc.property(
				fc.stringMatching(/^[A-Za-z0-9_]{5,32}$/),
				fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/),
				(botUsername, botToken) => {
					const link = botLink({ botUsername, botToken, telegramChatId: null });
					expect(link).toBe(`https://t.me/${botUsername}?start=${botToken}`);
				}
			)
		);
	});

	it('never builds a link once a chat id is bound, whatever the rest says', () => {
		fc.assert(
			fc.property(
				fc.stringMatching(/^[A-Za-z0-9_]{5,32}$/),
				fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/),
				fc.integer(),
				(botUsername, botToken, telegramChatId) => {
					expect(botLink({ botUsername, botToken, telegramChatId })).toBeNull();
				}
			)
		);
	});
});
