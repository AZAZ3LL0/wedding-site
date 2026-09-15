import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import { match } from '$lib/server/guests/match';
import { listMatchCandidates } from '$lib/server/guests/repo';
import { startSession } from '$lib/server/guests/session';
import type { MatchResult } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const findForm = z.object({ name: z.string().trim().min(1).max(100) });
const chooseForm = findForm.extend({ guestId: z.uuid() });

async function matchName(name: string): Promise<MatchResult> {
	const { byAudience } = getContent();
	return match(name, await listMatchCandidates(getDb()), {
		family: byAudience.family.label,
		friends: byAudience.friends.label,
		colleagues: byAudience.colleagues.label
	});
}

function unmatched(name: string, result: MatchResult) {
	return result.kind === 'ambiguous'
		? { name, status: 'choose' as const, candidates: result.candidates }
		: { name, status: 'notFound' as const, candidates: [] };
}

async function signIn(cookies: Parameters<typeof startSession>[1], guestId: string) {
	await startSession(getDb(), cookies, guestId, { secure: getConfig().isProduction });
	redirect(303, '/i');
}

export const load: PageServerLoad = ({ locals }) => {
	if (locals.guest) redirect(303, '/i');
};

export const actions: Actions = {
	find: async ({ request, cookies }) => {
		const parsed = findForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { name: '', status: 'invalid' as const, candidates: [] });

		const result = await matchName(parsed.data.name);
		if (result.kind === 'single') return signIn(cookies, result.guestId);
		return unmatched(parsed.data.name, result);
	},

	choose: async ({ request, cookies }) => {
		const parsed = chooseForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { name: '', status: 'invalid' as const, candidates: [] });
		const { name, guestId } = parsed.data;

		// The choice is re-derived from the name, so a posted id outside it never opens a card.
		const result = await matchName(name);
		const allowed =
			result.kind === 'single'
				? [result.guestId]
				: result.kind === 'ambiguous'
					? result.candidates.map((c) => c.guestId)
					: [];
		if (allowed.includes(guestId)) return signIn(cookies, guestId);
		return fail(400, unmatched(name, result));
	}
};
