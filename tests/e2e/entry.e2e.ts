import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';

const { entry, byAudience, rsvp } = content;

const entryForm = (page: Page) => page.getByRole('form', { name: entry.title });
const knownForm = (page: Page) => page.getByRole('form', { name: entry.knownTitle });

// Letters only, so every run registers a surname nobody else has.
function newcomer() {
	const letters = 'абвгдежзиклмнопрстуфхцчшэюя';
	const suffix = Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * 26)]).join('');
	return { firstName: 'Злата', lastName: `Новикова${suffix}` };
}

async function enterName(page: Page, firstName: string, lastName: string) {
	await page.goto('/');
	await entryForm(page).getByLabel(entry.firstNameLabel).fill(firstName);
	await entryForm(page).getByLabel(entry.lastNameLabel).fill(lastName);
	await entryForm(page).getByRole('button', { name: entry.submit }).click();
}

const hasSession = async (page: Page) =>
	(await page.context().cookies()).some((c) => c.name === 'guest_session');

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('sends a visitor without a session from the invitation to the entry form', async ({
	page
}) => {
	await page.goto('/i');
	await expect(page).toHaveURL('/');
	await expect(entryForm(page).getByLabel(entry.firstNameLabel)).toBeVisible();
});

test('registers a new guest, keeps them signed in and lets them answer', async ({ page }) => {
	const name = newcomer();
	await enterName(page, name.firstName, name.lastName);
	await expect(page).toHaveURL('/i');
	await expect(page.locator('[data-welcome]')).toContainText(name.firstName);

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

	// A self-registered guest may bring a companion.
	await page.goto('/rsvp');
	await expect(page.getByLabel(rsvp.companionOption)).toBeAttached();
});

test('a returning guest on another device picks their own card instead of a duplicate', async ({
	browser
}) => {
	const name = newcomer();
	const use = test.info().project.use;

	const first = await (await browser.newContext(use)).newPage();
	// The envelope now covers the entry page too; this test is about the form behind it.
	await first.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
	await enterName(first, name.firstName, name.lastName);
	await expect(first).toHaveURL('/i');
	await first.goto('/rsvp');
	await first.getByLabel(rsvp.attendingNo).check();
	await first.getByRole('button', { name: rsvp.submit }).click();
	await expect(first).toHaveURL('/thanks');

	// Another phone, a different case and a typo in the surname.
	const second = await (await browser.newContext(use)).newPage();
	await second.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
	await enterName(second, name.firstName.toUpperCase(), `${name.lastName.slice(0, -1)}ы`);
	await expect(second).toHaveURL('/');
	expect(await hasSession(second)).toBe(false);

	const known = knownForm(second);
	await expect(known.getByRole('radio')).toHaveCount(1);
	await known.getByRole('radio').check();
	await known.getByRole('button', { name: entry.submit }).click();
	await expect(second).toHaveURL('/i');
	// Same card: the answer from the first phone is there.
	await expect(second.locator('[data-rsvp-link]')).toHaveText(rsvp.ctaAnswered);
});

test('someone else with the same name opens a new invitation', async ({ page }) => {
	const name = newcomer();
	await enterName(page, name.firstName, name.lastName);
	await expect(page).toHaveURL('/i');
	await page.context().clearCookies();

	// A new surname each run, so the seed names do not collect duplicates between runs.
	await enterName(page, name.firstName, name.lastName);
	await expect(knownForm(page)).toBeVisible();
	await knownForm(page).getByRole('button', { name: entry.knownNew }).click();

	await expect(page).toHaveURL('/i');
	await page.context().clearCookies();
	await enterName(page, name.firstName, name.lastName);
	await expect(knownForm(page).getByRole('radio')).toHaveCount(2);
});

test('namesakes get hints to tell their cards apart', async ({ page }) => {
	await enterName(page, 'Анна', 'Сидорова');

	const known = knownForm(page);
	await expect(known.getByRole('radio')).toHaveCount(2);
	await expect(known.getByLabel(byAudience.family.label)).toBeVisible();
	await expect(known.getByLabel(byAudience.colleagues.label)).toBeVisible();

	await known.getByLabel(byAudience.colleagues.label).check();
	await known.getByRole('button', { name: entry.submit }).click();
	await expect(page).toHaveURL('/i');
	await expect(page.locator('[data-welcome]')).toContainText('Анна Сергеевна');
});

test('refuses a chosen card that the name does not match', async ({ page }) => {
	await enterName(page, 'Анна', 'Сидорова');
	const known = knownForm(page);
	const radio = known.getByRole('radio').first();

	// Ivan Ivanov from the seed: a real guest, but not an Anna.
	await radio.evaluate(
		(el: HTMLInputElement) => (el.value = '00000000-0000-4000-8000-000000000101')
	);
	await radio.check();
	await known.getByRole('button', { name: entry.submit }).click();

	await expect(knownForm(page)).toBeVisible();
	await expect(page).toHaveURL('/');
	expect(await hasSession(page)).toBe(false);
});

test('asks for a missing surname', async ({ page }) => {
	await page.goto('/');
	const form = entryForm(page);
	await form.evaluate((el: HTMLFormElement) => (el.noValidate = true));
	await form.getByLabel(entry.firstNameLabel).fill('Злата');
	await form.getByLabel(entry.lastNameLabel).fill('   ');
	await form.getByRole('button', { name: entry.submit }).click();

	await expect(page.getByText(entry.lastNameRequired)).toBeVisible();
	await expect(entryForm(page).getByLabel(entry.lastNameLabel)).toHaveAttribute(
		'aria-invalid',
		'true'
	);
	await expect(entryForm(page).getByLabel(entry.firstNameLabel)).toHaveValue('Злата');
	expect(await hasSession(page)).toBe(false);
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('registration and the known card choice work as plain posts', async ({ page }) => {
		const name = newcomer();
		await enterName(page, name.firstName, name.lastName);
		await expect(page).toHaveURL('/i');

		await page.context().clearCookies();
		await enterName(page, name.firstName, name.lastName);
		await knownForm(page).getByRole('radio').check();
		await knownForm(page).getByRole('button', { name: entry.submit }).click();
		await expect(page).toHaveURL('/i');
	});
});
