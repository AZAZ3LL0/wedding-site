import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { endAdminSession } from '$lib/server/admin/auth';
import { deleteGuest, listGuestRows, updateParty } from '$lib/server/admin/repo';
import { aggregate } from '$lib/server/admin/stats';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';
import { filterRows, readFilters } from './filters';

const partySchema = z.object({
	partyId: z.uuid(),
	audience: z.enum(['family', 'friends', 'colleagues']),
	plusOnePolicy: z.enum(['none', 'allowed']),
	invitedToRegistry: z.stringbool().default(false)
});

const guestSchema = z.object({ guestId: z.uuid() });

const failed = () => fail(500, { notice: 'failed' as const });

export const load: PageServerLoad = async ({ url }) => {
	const filters = readFilters(url.searchParams);
	const rows = await listGuestRows(getDb());
	const { menu } = getContent();
	return {
		filters,
		menu: { courses: menu.courses, drinks: menu.drinks },
		rows: filterRows(rows, filters),
		// Counters describe the whole guest list, the way the venue needs them; filters shape the
		// table only.
		stats: aggregate(rows, menu)
	};
};

export const actions: Actions = {
	signOut: async ({ cookies }) => {
		endAdminSession(cookies);
		redirect(303, '/admin/login');
	},

	updateParty: async ({ request }) => {
		const parsed = partySchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { notice: 'failed' as const });

		const { partyId, ...patch } = parsed.data;
		try {
			if (!(await updateParty(getDb(), partyId, patch))) return failed();
		} catch (error) {
			console.error('[admin] party not updated:', (error as Error).message);
			return failed();
		}
		return { notice: 'saved' as const };
	},

	deleteGuest: async ({ request }) => {
		const parsed = guestSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { notice: 'failed' as const });

		try {
			if (!(await deleteGuest(getDb(), parsed.data.guestId))) return failed();
		} catch (error) {
			console.error('[admin] guest not deleted:', (error as Error).message);
			return failed();
		}
		return { notice: 'deleted' as const };
	}
};
