import { randomBytes } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';

// A throwaway secret per run: the preview server and the suite are the only ones who know it.
export const WEBHOOK_SECRET = randomBytes(16).toString('hex');

let updateId = 0;

// Posts one update the way Telegram would, secret header included.
export function sendUpdate(
	request: APIRequestContext,
	baseURL: string,
	chatId: number,
	text: string
) {
	return request.post(`${baseURL}/api/telegram`, {
		headers: { 'x-telegram-bot-api-secret-token': WEBHOOK_SECRET },
		data: {
			update_id: ++updateId,
			message: { message_id: updateId, chat: { id: chatId, type: 'private' }, text }
		}
	});
}
