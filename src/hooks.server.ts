import type { Handle, ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { isAdmin } from '$lib/server/admin/auth';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import { sessionGuest } from '$lib/server/guests/session';

export const init: ServerInit = () => {
	if (building) return;

	// Fails fast on a broken environment or content before the first request.
	getConfig();
	getContent();
};

export const handle: Handle = async ({ event, resolve }) => {
	if (building) {
		event.locals.guest = null;
		event.locals.admin = false;
		return resolve(event);
	}
	event.locals.guest = await sessionGuest(getDb(), event.cookies);
	event.locals.admin = isAdmin(event.cookies, getConfig().sessionSecret);
	return resolve(event);
};
