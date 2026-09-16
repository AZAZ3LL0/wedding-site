import { fail, redirect } from '@sveltejs/kit';
import { checkAdminPassword, startAdminSession } from '$lib/server/admin/auth';
import { getConfig } from '$lib/server/config';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.admin) redirect(303, '/admin');
	// An unset ADMIN_PASSWORD closes the panel; the page says so instead of failing silently.
	return { configured: getConfig().adminPassword !== null };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const config = getConfig();
		const password = await request.formData().then((data) => data.get('password'));

		if (typeof password !== 'string' || !checkAdminPassword(password, config.adminPassword)) {
			return fail(401, { error: 'failed' as const });
		}

		startAdminSession(cookies, { secret: config.sessionSecret, secure: config.isProduction });
		redirect(303, '/admin');
	}
};
