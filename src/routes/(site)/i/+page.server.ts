import { redirect } from '@sveltejs/kit';
import { getContent } from '$lib/server/content';
import { welcome } from '$lib/server/guests/segment';
import type { PageServerLoad } from './$types';

// The invitation is personal: without a session the guest first finds their name.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.guest) redirect(303, '/');
	return { welcome: welcome(locals.guest, getContent()) };
};
