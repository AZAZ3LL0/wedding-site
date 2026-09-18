import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';
import { SECRET_HEADER, WEBHOOK_SECRET, sendUpdate } from './telegram';

const { rsvp } = content;

/**
 * The answer form no longer hands out the personal bot link, so the suite drives the webhook with
 * a token from the seed. Chat ids are fixed per guest: a rerun against the same database finds the
 * binding it made last time, which is the case the bot has to survive anyway.
 */
const GUEST = { firstName: 'Дмитрий', token: 'seed-token-dmitry-kozlov', chatId: 900000003 };

const inbox = (page: Page, chatId: number) =>
	page.locator('[data-message]').filter({ hasText: `${chatId}` });

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('a personal token binds the chat once and the bot answers from then on', async ({
	page,
	request,
	baseURL
}) => {
	const { token, chatId, firstName } = GUEST;

	const bound = await sendUpdate(request, baseURL!, chatId, `/start ${token}`);
	expect(bound.status()).toBe(200);
	// A second tap on the same link binds nothing new.
	const again = await sendUpdate(request, baseURL!, chatId, `/start ${token}`);
	expect(again.status()).toBe(200);

	await sendUpdate(request, baseURL!, chatId, '/address');
	await sendUpdate(request, baseURL!, chatId, '/rsvp');

	await page.goto('/kitchen-sink/telegram');
	const messages = inbox(page, chatId);
	await expect(messages.first()).toBeVisible({ timeout: 15_000 });
	// Whether this run bound the chat or found it bound, the repeat says so instead of binding again.
	await expect(
		messages.filter({ hasText: `${firstName}, вы уже подключены` }).first()
	).toBeVisible();
	await expect(messages.filter({ hasText: content.venue.address }).first()).toBeVisible();
	await expect(
		messages
			.filter({ hasText: new RegExp(`${rsvp.attendingYes}|${rsvp.attendingNo}|ещё не ответили`) })
			.first()
	).toBeVisible();
});

test('an unknown token is refused', async ({ page, request, baseURL }) => {
	const chatId = 900000009;
	const response = await sendUpdate(request, baseURL!, chatId, '/start not-a-real-token');
	expect(response.status()).toBe(200);

	await page.goto('/kitchen-sink/telegram');
	await expect(inbox(page, chatId).first()).toBeVisible({ timeout: 15_000 });
	await expect(inbox(page, chatId).filter({ hasText: 'не подошла' }).first()).toBeVisible();
});

test('the webhook refuses a request without the secret header', async ({ request, baseURL }) => {
	const response = await request.post(`${baseURL}/api/telegram`, {
		data: { update_id: 1, message: { chat: { id: 1, type: 'private' }, text: '/address' } }
	});

	expect(response.status()).toBe(404);
});

test('the webhook refuses the wrong secret', async ({ request, baseURL }) => {
	const response = await request.post(`${baseURL}/api/telegram`, {
		headers: { [SECRET_HEADER]: `${WEBHOOK_SECRET}x` },
		data: { update_id: 1, message: { chat: { id: 1, type: 'private' }, text: '/address' } }
	});

	expect(response.status()).toBe(404);
});

test('the webhook drops a body that is not an update instead of retrying it', async ({
	request,
	baseURL
}) => {
	const response = await request.post(`${baseURL}/api/telegram`, {
		headers: { [SECRET_HEADER]: WEBHOOK_SECRET },
		data: { nope: true }
	});

	expect(response.status()).toBe(400);
});
