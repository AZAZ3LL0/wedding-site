import { redirect } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import { findCompanion, findTelegramUsername } from '$lib/server/rsvp/repo';
import { isRsvpOpen } from '$lib/server/rsvp/service';
import { botLink } from '$lib/server/telegram/link';
import { findBotLinkRow } from '$lib/server/telegram/repo';
import type { PageServerLoad } from './$types';
import { answerRows, companionSummary } from './summary';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.guest) redirect(303, '/');
	const { rsvp, id } = locals.guest;
	if (!rsvp) redirect(303, '/rsvp');

	const content = getContent();
	const db = getDb();
	const [telegramUsername, companion, link] = await Promise.all([
		findTelegramUsername(db, id),
		findCompanion(db, id),
		findBotLinkRow(db, id)
	]);

	return {
		attending: rsvp.attending,
		rows: answerRows(rsvp, telegramUsername, content),
		companion: companion ? companionSummary(companion, content) : null,
		canEdit: isRsvpOpen(content.event, new Date()),
		// The one place botToken reaches a browser, and only the guest's own (tech.md §11).
		botLink: link ? botLink({ ...link, botUsername: getConfig().telegram.botUsername }) : null
	};
};
