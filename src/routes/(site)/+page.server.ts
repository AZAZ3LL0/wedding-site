import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import { match } from '$lib/server/guests/match';
import { insertUnknownRequest, listMatchCandidates } from '$lib/server/guests/repo';
import { startSession } from '$lib/server/guests/session';
import { getAppQueue } from '$lib/server/queue/boss';
import type { MatchResult } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const findForm = z.object({ name: z.string().trim().min(1).max(100) });
const chooseForm = findForm.extend({ guestId: z.uuid() });
const unknownForm = findForm.extend({
	contact: z
		.string()
		.trim()
		.max(100)
		.transform((value) => value || null)
});

type Status = 'invalid' | 'notFound' | 'choose' | 'unknownInvalid' | 'sent' | 'failed';
type Candidates = Extract<MatchResult, { kind: 'ambiguous' }>['candidates'];

// One shape for every outcome, so the page reads any field without narrowing on the action.
function state(status: Status, name = '', { contact = '', candidates = [] as Candidates } = {}) {
	return { status, name, contact, candidates };
}

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
		? state('choose', name, { candidates: result.candidates })
		: state('notFound', name);
}

async function signIn(cookies: Parameters<typeof startSession>[1], guestId: string) {
	await startSession(getDb(), cookies, guestId, { secure: getConfig().isProduction });
	redirect(303, '/i');
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.guest) redirect(303, '/i');
	// A plain link opens the request form, so it works before JavaScript loads.
	return { notListed: url.searchParams.has('unknown') };
};

export const actions: Actions = {
	find: async ({ request, cookies }) => {
		const parsed = findForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, state('invalid'));

		const result = await matchName(parsed.data.name);
		if (result.kind === 'single') return signIn(cookies, result.guestId);
		return unmatched(parsed.data.name, result);
	},

	choose: async ({ request, cookies }) => {
		const parsed = chooseForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, state('invalid'));
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
	},

	unknown: async ({ request }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = unknownForm.safeParse(raw);
		if (!parsed.success) {
			const text = (value: FormDataEntryValue | undefined) =>
				typeof value === 'string' ? value : '';
			return fail(400, state('unknownInvalid', text(raw.name), { contact: text(raw.contact) }));
		}
		const { name, contact } = parsed.data;

		let requestId: string;
		try {
			requestId = await insertUnknownRequest(getDb(), { rawName: name, contact });
		} catch (error) {
			console.error('[unknown] request not saved:', (error as Error).message);
			return fail(500, state('failed', name, { contact: contact ?? '' }));
		}

		// The request is already saved and waits in the admin, so a queue outage is not the guest's problem.
		try {
			const queue = await getAppQueue();
			await queue.sendUnknownNotifyAdmin(requestId);
		} catch (error) {
			console.error(`[unknown] ${requestId} not queued:`, (error as Error).message);
		}
		return state('sent', name);
	}
};
