import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getConfig } from '$lib/server/config';

// A development page: open in dev, and in a build only when SHOW_KITCHEN_SINK says so (e2e).
export const load = () => {
	if (!dev && !getConfig().showKitchenSink) error(404);
};
