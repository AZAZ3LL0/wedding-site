import type { ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getConfig } from '$lib/server/config';
import { getDb } from '$lib/server/db';
import { getQueue } from '$lib/server/queue/boss';
import { getTelegramClient } from '$lib/server/telegram';

export const init: ServerInit = async () => {
	if (building) return;

	// Fails fast on a broken environment before the first request.
	const config = getConfig();
	const queue = await getQueue(() => ({
		connectionString: config.databaseUrl,
		db: getDb(),
		telegram: getTelegramClient(),
		adminChatId: config.telegram.adminChatId
	}));
	process.once('sveltekit:shutdown', () => void queue.stop());
};
