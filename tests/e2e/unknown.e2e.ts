import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';

const { entry, unknown } = content;

// Letters only, so every run files a name nobody on the list has.
function strangerName() {
	const letters = 'абвгдежзиклмнопрстуфхцчшэюя';
	const suffix = Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * 26)]).join('');
	return `Гость Незнакомый${suffix}`;
}

const requestForm = (page: Page) => page.getByRole('form', { name: unknown.title });

test('files a request after a miss and tells the organizer in Telegram', async ({ page }) => {
	const name = strangerName();
	await page.goto('/');
	const entryForm = page.getByRole('form', { name: entry.title });
	await entryForm.getByLabel(entry.nameLabel).fill(name);
	await entryForm.getByRole('button', { name: entry.submit }).click();
	await expect(page.getByText(entry.notFound)).toBeVisible();

	const form = requestForm(page);
	await expect(form.getByLabel(unknown.nameLabel)).toHaveValue(name);
	await form.getByLabel(unknown.contactLabel).fill('@stranger_guest');
	await form.getByRole('button', { name: unknown.submit }).click();

	await expect(page.getByRole('status')).toHaveText(unknown.sent);
	await expect(requestForm(page)).toHaveCount(0);

	// The fake client keeps what the worker sent; the page polls it.
	await page.goto('/kitchen-sink/telegram');
	const message = page.locator('[data-message]').filter({ hasText: name });
	await expect(message).toHaveCount(1, { timeout: 15_000 });
	await expect(message).toContainText('@stranger_guest');
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the not-on-the-list link opens the form and a request needs no contact', async ({
		page
	}) => {
		const name = strangerName();
		await page.goto('/');
		await expect(requestForm(page)).toHaveCount(0);
		await page.getByRole('link', { name: entry.notListed }).click();

		const form = requestForm(page);
		await form.getByLabel(unknown.nameLabel).fill(name);
		await form.getByRole('button', { name: unknown.submit }).click();

		await expect(page.getByRole('status')).toHaveText(unknown.sent);
	});
});
