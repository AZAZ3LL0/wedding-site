// Every message to Telegram goes through this interface, see tech.md §5.
export type SendMessageInput = { chatId: number; text: string };
export type SentMessage = { messageId: number };

export interface TelegramClient {
	sendMessage(input: SendMessageInput): Promise<SentMessage>;
}

// server: 5xx and network errors, timeout: no response, rejected: 4xx (bot blocked, chat not found).
export type TelegramErrorKind = 'server' | 'timeout' | 'rejected';

export class TelegramError extends Error {
	constructor(
		readonly kind: TelegramErrorKind,
		message: string
	) {
		super(message);
		this.name = 'TelegramError';
	}
}
