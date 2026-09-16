import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';
import { SECRET_HEADER, WEBHOOK_SECRET, sendUpdate } from './telegram';

const { entry, rsvp, thanks } = content;

const form = (page: Page) => page.getByRole('form', { name: rsvp.title });

// Letters only, so every run registers a guest with a brand new bot token.
function newcomer() {
	const letters = 'абвгдежзиклмнопрстуфхцчшэюя';
	const suffix = Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * 26)]).join('');
	return { firstName: 'Тимур', lastName: `Ботов${suffix}` };
}

let chatSeq = Date.now() % 1_000_000;
const newChatId = () => 2_000_000 + ++chatSeq;

/** Registers a guest, answers yes, and returns the bot token from the link on /thanks. */
async function registerAndAnswer(page: Page): Promise<{ token: string; firstName: string }> {
	const name = newcomer();
	await page.goto('/');
	const entryForm = page.getByRole('form', { name: entry.title });
	await entryForm.getByLabel(entry.firstNameLabel).fill(name.firstName);
	await entryForm.getByLabel(entry.lastNameLabel).fill(name.lastName);
	await entryForm.getByRole('button', { name: entry.submit }).click();
	await expect(page).toHaveURL('/i');

	await page.goto('/rsvp');
	await form(page).getByLabel(rsvp.attendingYes).check();
	await form(page)
		.getByRole('button', { name: new RegExp(`^(${rsvp.submit}|${rsvp.save})$`) })
		.click();
	await expect(page).toHaveURL('/thanks');

	const link = page.locator('[data-bot-link] a');
	await expect(link).toHaveText(thanks.bot.cta);
	const href = await link.getAttribute('href');
	const token = new URL(href!).searchParams.get('start');
	expect(token).toBeTruthy();
	return { token: token!, firstName: name.firstName };
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('the guest opens the personal link, binds the chat and talks to the bot', async ({
	page,
	request,
	baseURL
}) => {
	const { token, firstName } = await registerAndAnswer(page);
	const chatId = newChatId();

	const bound = await sendUpdate(request, baseURL!, chatId, `/start ${token}`);
	expect(bound.status()).toBe(200);

	// The link disappears from /thanks once the chat is bound.
	await page.reload();
	await expect(page.locator('[data-bot-link]')).toHaveCount(0);

	// A second tap on the same link binds nothing new.
	await sendUpdate(request, baseURL!, chatId, `/start ${token}`);

	await sendUpdate(request, baseURL!, chatId, '/address');
	await sendUpdate(request, baseURL!, chatId, '/rsvp');

	await page.goto('/kitchen-sink/telegram');
	const inbox = page.locator('[data-message]').filter({ hasText: `${chatId}` });
	await expect(inbox.first()).toBeVisible({ timeout: 15_000 });
	// The bot greets the guest by name once, then reports the binding it already has.
	await expect(inbox.filter({ hasText: `${firstName}, готово` })).toHaveCount(1);
	await expect(inbox.filter({ hasText: `${firstName}, вы уже подключены` })).toHaveCount(1);
	await expect(inbox.filter({ hasText: content.venue.address })).toHaveCount(1);
	await expect(inbox.filter({ hasText: rsvp.attendingYes })).toHaveCount(1);
});

test('the guest changes the answer to no from the bot', async ({ page, request, baseURL }) => {
	const { token } = await registerAndAnswer(page);
	const chatId = newChatId();
	await sendUpdate(request, baseURL!, chatId, `/start ${token}`);

	const changed = await sendUpdate(request, baseURL!, chatId, '/no');
	expect(changed.status()).toBe(200);

	await page.goto('/thanks');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(thanks.titleNo);
	await expect(page.locator('[data-summary]')).toContainText(rsvp.attendingNo);
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
