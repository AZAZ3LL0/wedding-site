import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The invitation is personal: without a session the guest first finds their name.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.guest) redirect(303, '/');
	return { answered: locals.guest.rsvp !== null };
};
