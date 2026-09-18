import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';
import { signIn } from './guest';

const { rsvp, thanks } = content;

// Its own seed guest, so suites running in parallel never overwrite this answer.
const GUEST = 'Мария Иванова';

const form = (page: Page) => page.getByRole('form', { name: rsvp.title });
// The label depends on whether an earlier run already left an answer.
const submit = (page: Page) =>
	form(page).getByRole('button', { name: new RegExp(`^(${rsvp.submit}|${rsvp.save})$`) });
const thanksTitle = (page: Page) => page.getByRole('heading', { level: 1 });

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page, context, baseURL }) => {
	await signIn(context, baseURL!, GUEST);
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('the guest gives a name and an answer and is thanked where they are', async ({ page }) => {
	await page.goto('/rsvp');

	const answer = form(page);
	// The form asks for the name, the answer and the companion, and nothing else.
	await expect(answer.getByLabel(rsvp.nameLabel)).toHaveValue(GUEST);
	for (const label of [
		rsvp.coursesLabel,
		rsvp.drinksLabel,
		rsvp.allergiesLabel,
		rsvp.commentLabel,
		rsvp.telegramLabel,
		rsvp.registryLabel
	]) {
		await expect(answer.getByText(label, { exact: true })).toHaveCount(0);
	}

	await answer.getByLabel(rsvp.nameLabel).fill(GUEST);
	await answer.getByLabel(rsvp.attendingYes).check();
	await submit(page).click();

	// No new page: the form is replaced by the thanks, and the answer is with the hosts.
	await expect(page).toHaveURL('/rsvp');
	await expect(thanksTitle(page)).toHaveText(thanks.titleYes);
	await expect(form(page)).toHaveCount(0);

	// The organizer hears about it through rsvp.notify-admin; the fake client keeps the message.
	await page.goto('/kitchen-sink/telegram');
	const notice = page.locator('[data-message]').filter({ hasText: GUEST });
	await expect(notice.first()).toBeVisible({ timeout: 15_000 });

	// Coming back shows the saved answer.
	await page.goto('/rsvp');
	const saved = form(page);
	await expect(saved.getByLabel(rsvp.nameLabel)).toHaveValue(GUEST);
	await expect(saved.getByLabel(rsvp.attendingYes)).toBeChecked();
	await expect(saved.getByRole('button', { name: rsvp.save })).toBeVisible();
});

test('the invitation leads to the same form once answered', async ({ page }) => {
	await page.goto('/i');
	const link = page.locator('[data-rsvp-link]');
	await expect(link).toHaveText(rsvp.ctaAnswered);
	await link.click();
	await expect(page).toHaveURL('/rsvp');
});

test('declining is thanked too and is remembered', async ({ page }) => {
	await page.goto('/rsvp');
	await form(page).getByLabel(rsvp.attendingNo).check();
	await submit(page).click();
	await expect(thanksTitle(page)).toHaveText(thanks.titleNo);

	await page.goto('/rsvp');
	await expect(form(page).getByLabel(rsvp.attendingNo)).toBeChecked();
});

test('a form without a name is refused next to the field', async ({ page }) => {
	await page.goto('/rsvp');
	await form(page).getByLabel(rsvp.nameLabel).fill('   ');
	await form(page).getByLabel(rsvp.attendingYes).check();
	await submit(page).click();

	await expect(page.getByText(rsvp.nameRequired)).toBeVisible();
	await expect(form(page).getByLabel(rsvp.nameLabel)).toHaveAttribute('aria-invalid', 'true');
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the form posts as a plain page and saves the answer', async ({ page }) => {
		await page.goto('/rsvp');
		await form(page).getByLabel(rsvp.nameLabel).fill('Мария Иванова');
		await form(page).getByLabel(rsvp.attendingYes).check();
		await submit(page).click();
		await expect(thanksTitle(page)).toHaveText(thanks.titleYes);

		await page.goto('/rsvp');
		await expect(form(page).getByLabel(rsvp.attendingYes)).toBeChecked();
	});
});

test.describe('a guest who corrects their name', () => {
	// Registers a guest of its own: the name in the form replaces the one the card was opened with.
	const letters = 'абвгдежзиклмнопрстуфхцчшэюя';
	const surname = () =>
		`Тихонова${Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * 26)]).join('')}`;

	test('the answer reaches the organizer under the corrected name', async ({ page, context }) => {
		await context.clearCookies();
		const entry = content.entry;
		const typed = surname();
		await page.goto('/');
		const entryForm = page.getByRole('form', { name: entry.title });
		await entryForm.getByLabel(entry.firstNameLabel).fill('Злата');
		await entryForm.getByLabel(entry.lastNameLabel).fill(typed);
		await entryForm.getByRole('button', { name: entry.submit }).click();
		await expect(page).toHaveURL('/i');

		const corrected = `Злата ${typed}-Тихая`;
		await page.goto('/rsvp');
		await form(page).getByLabel(rsvp.nameLabel).fill(corrected);
		await form(page).getByLabel(rsvp.attendingYes).check();
		await submit(page).click();
		await expect(thanksTitle(page)).toHaveText(thanks.titleYes);

		await page.goto('/kitchen-sink/telegram');
		const notice = page.locator('[data-message]').filter({ hasText: corrected });
		await expect(notice.first()).toBeVisible({ timeout: 15_000 });

		// The card is the same one: the corrected name opens it again.
		await page.goto('/rsvp');
		await expect(form(page).getByLabel(rsvp.nameLabel)).toHaveValue(corrected);
	});
});
