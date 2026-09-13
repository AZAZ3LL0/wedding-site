import { z } from 'zod';
import {
	TelegramError,
	type SendMessageInput,
	type SentMessage,
	type TelegramClient,
	type TelegramErrorKind
} from './client';

// Mirrors Bot API limits, so a slice that sends garbage fails in tests instead of in production.
const sendMessageSchema = z.object({
	chatId: z.number().int(),
	text: z.string().min(1).max(4096)
});

export type FakeMessage = SendMessageInput & SentMessage & { sentAt: Date };

export class FakeTelegramClient implements TelegramClient {
	readonly sent: FakeMessage[] = [];
	private nextFailure: TelegramErrorKind | null = null;
	private lastMessageId = 0;

	failNext(kind: TelegramErrorKind): void {
		this.nextFailure = kind;
	}

	async sendMessage(input: SendMessageInput): Promise<SentMessage> {
		const valid = sendMessageSchema.parse(input);

		if (this.nextFailure) {
			const kind = this.nextFailure;
			this.nextFailure = null;
			throw new TelegramError(kind, `fake ${kind} failure`);
		}

		const messageId = ++this.lastMessageId;
		this.sent.push({ ...valid, messageId, sentAt: new Date() });
		return { messageId };
	}
}
