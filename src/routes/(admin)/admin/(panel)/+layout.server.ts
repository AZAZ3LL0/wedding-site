import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// The guard for the whole panel group. Endpoints skip layout loads, so they check locals.admin
// themselves (see (panel)/export/+server.ts).
export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.admin) redirect(303, '/admin/login');
};
