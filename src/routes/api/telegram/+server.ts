import { json, text } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import { getAppQueue } from '$lib/server/queue/boss';
import { handleUpdate } from '$lib/server/telegram/bot';
import { getTelegramClient } from '$lib/server/telegram';
import { telegramUpdateSchema } from '$lib/server/telegram/update';
import { SECRET_HEADER, secretMatches } from '$lib/server/telegram/webhook';
import type { RequestHandler } from './$types';

/**
 * The Telegram webhook (tech.md §13, 5.1). Telegram redelivers an update until it gets a 2xx:
 * a handled update answers 200 even when the bot decided to stay quiet, an update that does not
 * match the contract is dropped with 400 instead of being retried forever, and a failure on our
 * side answers 500 so the update comes back.
 */
export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	if (!secretMatches(config.telegram.webhookSecret, request.headers.get(SECRET_HEADER))) {
		return text('not found', { status: 404 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return text('bad request', { status: 400 });
	}

	const update = telegramUpdateSchema.safeParse(body);
	if (!update.success) return text('bad request', { status: 400 });

	try {
		const outcome = await handleUpdate(
			{
				db: getDb(),
				telegram: getTelegramClient(),
				content: getContent(),
				notifyAdmin: async (job) => {
					await (await getAppQueue()).sendRsvpNotifyAdmin(job);
				}
			},
			update.data
		);
		return json({ ok: true, outcome });
	} catch (error) {
		console.error('[telegram] update not handled:', (error as Error).message);
		return text('server error', { status: 500 });
	}
};
