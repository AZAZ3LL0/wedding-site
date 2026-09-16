import { Bot, GrammyError, HttpError } from 'grammy';
import {
	TelegramError,
	type SendMessageInput,
	type SentMessage,
	type TelegramClient
} from './client';

// Telegram answers a sendMessage within a second or two; a longer wait is worth retrying.
const TIMEOUT_SECONDS = 10;

/**
 * Maps a grammY failure onto the three kinds tech.md §5 defines, which is what decides whether
 * the queue retries the job or gives up on it.
 */
export function asTelegramError(error: unknown): TelegramError {
	if (error instanceof GrammyError) {
		// 4xx is the bot being blocked, a deleted chat or a bad request: retrying changes nothing.
		const kind = error.error_code >= 500 ? 'server' : 'rejected';
		return new TelegramError(kind, `${error.error_code} ${error.description}`);
	}
	if (error instanceof HttpError) {
		const cause = error.error;
		const timedOut =
			cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError');
		return new TelegramError(timedOut ? 'timeout' : 'server', error.message);
	}
	return new TelegramError('server', error instanceof Error ? error.message : 'unknown error');
}

export class RealTelegramClient implements TelegramClient {
	private readonly bot: Bot;

	constructor(botToken: string) {
		// The bot never long-polls: updates arrive through routes/api/telegram.
		this.bot = new Bot(botToken, { client: { timeoutSeconds: TIMEOUT_SECONDS } });
	}

	async sendMessage({ chatId, text }: SendMessageInput): Promise<SentMessage> {
		try {
			const sent = await this.bot.api.sendMessage(chatId, text);
			return { messageId: sent.message_id };
		} catch (error) {
			throw asTelegramError(error);
		}
	}
}
