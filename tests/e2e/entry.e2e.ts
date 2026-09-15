import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';

const { entry, byAudience } = content;

const nameInput = (page: Page) =>
	page.getByRole('form', { name: entry.title }).getByLabel(entry.nameLabel);

async function enterName(page: Page, name: string) {
	await page.goto('/');
	await nameInput(page).fill(name);
	await page.getByRole('form', { name: entry.title }).getByRole('button').click();
}

test('sends a visitor without a session from the invitation to the name form', async ({ page }) => {
	await page.goto('/i');
	await expect(page).toHaveURL('/');
	await expect(nameInput(page)).toBeVisible();
});

test('opens the invitation for a listed name and keeps the guest signed in', async ({ page }) => {
	await enterName(page, 'иванов иван');
	await expect(page).toHaveURL('/i');

	await page.reload();
	await expect(page).toHaveURL('/i');

	// The shared link lands straight on the card for a returning guest.
	await page.goto('/');
	await expect(page).toHaveURL('/i');

	const [cookie] = (await page.context().cookies()).filter((c) => c.name === 'guest_session');
	expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
	const days = (cookie!.expires * 1000 - Date.now()) / (24 * 60 * 60 * 1000);
	expect(days).toBeGreaterThan(89.9);
	expect(days).toBeLessThanOrEqual(90);
});

test('lets a namesake choose instead of opening someone else’s invitation', async ({ page }) => {
	await enterName(page, 'Анна Сидорова');

	await expect(page).toHaveURL('/');
	const choice = page.getByRole('form', { name: entry.chooseTitle });
	await expect(choice).toBeVisible();
	const options = choice.getByRole('radio');
	await expect(options).toHaveCount(2);
	await expect(choice.getByLabel(byAudience.family.label)).toBeVisible();
	await expect(choice.getByLabel(byAudience.colleagues.label)).toBeVisible();
	expect((await page.context().cookies()).some((c) => c.name === 'guest_session')).toBe(false);

	await choice.getByLabel(byAudience.colleagues.label).check();
	await choice.getByRole('button', { name: entry.submit }).click();
	await expect(page).toHaveURL('/i');
});

test('refuses a chosen card that is not among the namesakes', async ({ page }) => {
	await enterName(page, 'Анна Сидорова');
	const choice = page.getByRole('form', { name: entry.chooseTitle });
	const radio = choice.getByRole('radio').first();

	// Ivan Ivanov from the seed: a valid guest, but not an Anna.
	await radio.evaluate(
		(el: HTMLInputElement) => (el.value = '00000000-0000-4000-8000-000000000101')
	);
	await radio.check();
	await choice.getByRole('button', { name: entry.submit }).click();

	await expect(choice).toBeVisible();
	await expect(page).toHaveURL('/');
	expect((await page.context().cookies()).some((c) => c.name === 'guest_session')).toBe(false);
});

test('says the name is not on the list', async ({ page }) => {
	await enterName(page, 'Пётр Первый');
	await expect(page).toHaveURL('/');
	await expect(page.getByText(entry.notFound)).toBeVisible();
	await expect(nameInput(page)).toHaveValue('Пётр Первый');
	await expect(nameInput(page)).toHaveAttribute('aria-invalid', 'true');
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the form still signs the guest in', async ({ page }) => {
		await enterName(page, 'Дмитрий Козлов');
		await expect(page).toHaveURL('/i');
	});
});
