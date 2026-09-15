import { expect, type BrowserContext } from '@playwright/test';
import { seedGuests } from '../../scripts/seed';

export const SIGNED_IN_AS = 'Иван Иванов';

/**
 * Signs the context in as a seed guest through the form actions, so suites about the invitation
 * skip the entry UI. A seed name is always known, so this picks its card; pass `guestId` to pick
 * one of several namesakes.
 */
export async function signIn(
	context: BrowserContext,
	baseURL: string,
	name = SIGNED_IN_AS,
	guestId?: string
) {
	const seedGuest = seedGuests.find((g) => `${g.firstName} ${g.lastName}` === name);
	if (!seedGuest) throw new Error(`${name} is not a seed guest`);
	// A companion's name opens the inviter's card.
	const cardId = guestId ?? seedGuest.invitedByGuestId ?? seedGuest.id;

	const response = await context.request.post(`${baseURL}/?/choose`, {
		form: { firstName: seedGuest.firstName, lastName: seedGuest.lastName, guestId: cardId },
		// What a browser sends for a plain form post: SvelteKit rejects cross-site posts, and
		// without text/html it answers with a JSON result instead of the redirect.
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	expect(response.headers().location).toBe('/i');
	expect((await context.cookies()).map((c) => c.name)).toContain('guest_session');
}
