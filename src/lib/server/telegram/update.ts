import { z } from 'zod';

/**
 * The slice of a Telegram update the bot acts on, validated at the webhook boundary
 * (tech.md §11). Everything else in an update is ignored on purpose: the bot reads private
 * text messages and nothing more, so a new Bot API field can never change what it does.
 */
export const telegramUpdateSchema = z.looseObject({
	update_id: z.number().int(),
	message: z
		.looseObject({
			chat: z.looseObject({ id: z.number().int(), type: z.string() }),
			text: z.string().optional()
		})
		.optional()
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export type BotCommand = { command: string; argument: string };

const COMMAND = /^\/([A-Za-z0-9_]{1,64})(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/s;

/**
 * Reads the command out of a message. Telegram sends `/start token` in a private chat and
 * `/start@wedding_bot token` in a group, so the bot mention is stripped before matching.
 */
export function parseCommand(text: string | undefined): BotCommand | null {
	const match = COMMAND.exec(text?.trim() ?? '');
	if (!match) return null;
	return { command: match[1]!.toLowerCase(), argument: match[2]?.trim() ?? '' };
}

export type IncomingMessage = { chatId: number; command: BotCommand };

// A private chat only: the bot answers one guest about their own answer, never a group.
export function incoming(update: TelegramUpdate): IncomingMessage | null {
	const message = update.message;
	if (!message || message.chat.type !== 'private') return null;
	const command = parseCommand(message.text);
	return command ? { chatId: message.chat.id, command } : null;
}
