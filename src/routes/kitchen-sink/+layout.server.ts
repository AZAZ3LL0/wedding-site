import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getConfig } from '$lib/server/config';

// Closed in production: open only in dev and while the app runs on the fake Telegram client.
export const load = () => {
	if (!dev && !getConfig().telegram.useFake) error(404);
};
