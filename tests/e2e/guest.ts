import { expect, type BrowserContext } from '@playwright/test';

export const SIGNED_IN_AS = 'Иван Иванов';

/**
 * Signs the context in through the form actions, so suites about the invitation skip the entry
 * UI. Pass `guestId` to pick one of several namesakes.
 */
export async function signIn(
	context: BrowserContext,
	baseURL: string,
	name = SIGNED_IN_AS,
	guestId?: string
) {
	const action = guestId ? 'choose' : 'find';
	const response = await context.request.post(`${baseURL}/?/${action}`, {
		form: guestId ? { name, guestId } : { name },
		// What a browser sends for a plain form post: SvelteKit rejects cross-site posts, and
		// without text/html it answers with a JSON result instead of the redirect.
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	expect(response.headers().location).toBe('/i');
	expect((await context.cookies()).map((c) => c.name)).toContain('guest_session');
}
