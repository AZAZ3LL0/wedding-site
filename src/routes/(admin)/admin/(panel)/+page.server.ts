import { redirect } from '@sveltejs/kit';
import { endAdminSession } from '$lib/server/admin/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	signOut: async ({ cookies }) => {
		endAdminSession(cookies);
		redirect(303, '/admin/login');
	}
};
