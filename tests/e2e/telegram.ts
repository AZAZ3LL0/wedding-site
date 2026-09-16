import type { APIRequestContext } from '@playwright/test';

/**
 * Webhook secret for the preview server that playwright.config.ts starts. Throwaway by
 * definition: the server lives for one run against a local database, and the real secret comes
 * from the server environment. A constant, not a random value, because the config and the test
 * workers are separate processes and both have to arrive at the same string.
 */
export const WEBHOOK_SECRET = process.env.E2E_WEBHOOK_SECRET ?? 'e2e-telegram-webhook-secret';

export const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

// Without a username the deep link is hidden by design, so /thanks needs one to show the button.
export const BOT_USERNAME = process.env.E2E_BOT_USERNAME ?? 'e2e_wedding_bot';

let updateId = 0;

// Posts one update the way Telegram would, secret header included.
export function sendUpdate(
	request: APIRequestContext,
	baseURL: string,
	chatId: number,
	text: string
) {
	return request.post(`${baseURL}/api/telegram`, {
		headers: { [SECRET_HEADER]: WEBHOOK_SECRET },
		data: {
			update_id: ++updateId,
			message: { message_id: updateId, chat: { id: chatId, type: 'private' }, text }
		}
	});
}
