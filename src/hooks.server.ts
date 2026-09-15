import type { ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getAppQueue } from '$lib/server/queue/boss';

export const init: ServerInit = async () => {
	if (building) return;

	// Fails fast on a broken environment or content before the first request.
	getConfig();
	getContent();
	const queue = await getAppQueue();
	process.once('sveltekit:shutdown', () => void queue.stop());
};
