import { fail, redirect } from '@sveltejs/kit';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import { findGuestName, renameGuest } from '$lib/server/guests/repo';
import { getAppQueue } from '$lib/server/queue/boss';
import { findCompanion } from '$lib/server/rsvp/repo';
import { isRsvpOpen, submitRsvp } from '$lib/server/rsvp/service';
import type { Actions, PageServerLoad } from './$types';
import { errorOf, readForm, toSubmission, valuesOf, type FormError, type FormValues } from './form';

// One shape for every failure, so the page reads the error and the typed values without narrowing.
const failure = (status: number, error: FormError, values: FormValues) =>
	fail(status, { error, values });

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.guest) redirect(303, '/');
	const { rsvp, id, plusOnePolicy } = locals.guest;

	const plusOneAllowed = plusOnePolicy === 'allowed';
	const db = getDb();
	const [name, companion] = await Promise.all([
		findGuestName(db, id),
		plusOneAllowed ? findCompanion(db, id) : null
	]);
	return {
		open: isRsvpOpen(getContent().event, new Date()),
		answered: rsvp !== null,
		plusOneAllowed,
		values: valuesOf(name, rsvp, companion)
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.guest) redirect(303, '/');

		const values = readForm(await request.formData());
		const parsed = toSubmission(values);
		if (!parsed.ok) return failure(400, parsed.error, values);

		let result: Awaited<ReturnType<typeof submitRsvp>>;
		try {
			// The name first: an answer saved under the old spelling would reach the organizer wrong.
			await renameGuest(getDb(), locals.guest.id, parsed.submission.name);
			result = await submitRsvp(getDb(), locals.guest.id, parsed.submission.payload, {
				content: getContent(),
				source: 'web'
			});
		} catch (error) {
			console.error('[rsvp] answer not saved:', (error as Error).message);
			return failure(500, 'failed', values);
		}

		if (result.kind === 'missing') redirect(303, '/');
		if (result.kind === 'closed') return failure(403, 'closed', values);
		if (result.kind === 'rejected') return failure(400, errorOf(result.reason), values);

		// The answer is already saved and shows in the admin, so a queue outage is not the guest's problem.
		try {
			const queue = await getAppQueue();
			await queue.sendRsvpNotifyAdmin({
				guestId: locals.guest.id,
				kind: result.created ? 'created' : 'updated',
				updatedAt: result.updatedAt
			});
		} catch (error) {
			console.error(`[rsvp] ${locals.guest.id} notice not queued:`, (error as Error).message);
		}
		// The guest goes nowhere: the page thanks them where they are.
		return { sent: values.attending, values };
	}
};
