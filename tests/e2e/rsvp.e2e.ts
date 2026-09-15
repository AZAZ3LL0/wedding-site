import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';
import { signIn } from './guest';

const { rsvp, thanks, menu } = content;

// Its own seed guest, so suites running in parallel never overwrite this answer.
const GUEST = 'Мария Иванова';

const form = (page: Page) => page.getByRole('form', { name: rsvp.title });
// The label depends on whether an earlier run already left an answer.
const submit = (page: Page) =>
	form(page).getByRole('button', { name: new RegExp(`^(${rsvp.submit}|${rsvp.save})$`) });
const course = (page: Page, index = 0) =>
	form(page)
		.getByRole('radiogroup', { name: rsvp.coursesLabel })
		.getByLabel(menu.courses[index]!.label);
const drink = (page: Page, index = 0) =>
	form(page).getByRole('group', { name: rsvp.drinksLabel }).getByLabel(menu.drinks[index]!.label);

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page, context, baseURL }) => {
	await signIn(context, baseURL!, GUEST);
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('the guest answers yes, sees the summary and finds the answer again', async ({ page }) => {
	await page.goto('/rsvp');

	const answer = form(page);
	await answer.getByLabel(rsvp.attendingYes).check();
	await course(page).check();
	await drink(page).check();
	await answer.getByLabel(rsvp.allergiesLabel).fill('Орехи');
	await answer.getByLabel(rsvp.commentLabel).fill('Приеду к началу');
	await answer.getByLabel(rsvp.telegramLabel).fill('@maria_ivanova');
	await submit(page).click();

	await expect(page).toHaveURL('/thanks');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(thanks.titleYes);
	const summary = page.locator('[data-summary]');
	await expect(summary).toContainText(rsvp.attendingYes);
	await expect(summary).toContainText(menu.courses[0]!.label);
	await expect(summary).toContainText('Орехи');
	await expect(summary).toContainText('@maria_ivanova');

	// Once answered, the invitation leads to the summary instead of an empty form.
	await page.goto('/i');
	const link = page.locator('[data-rsvp-link]');
	await expect(link).toHaveText(rsvp.ctaAnswered);
	await link.click();
	await expect(page).toHaveURL('/thanks');

	// The organizer hears about it through rsvp.notify-admin; the fake client keeps the message.
	await page.goto('/kitchen-sink/telegram');
	const notice = page
		.locator('[data-message]')
		.filter({ hasText: GUEST })
		.filter({ hasText: 'Аллергии: Орехи' });
	await expect(notice.first()).toBeVisible({ timeout: 15_000 });
	await expect(notice.first()).toContainText('@maria_ivanova');

	await page.goto('/rsvp');
	const saved = form(page);
	await expect(saved.getByLabel(rsvp.attendingYes)).toBeChecked();
	await expect(course(page)).toBeChecked();
	await expect(drink(page)).toBeChecked();
	await expect(saved.getByLabel(rsvp.allergiesLabel)).toHaveValue('Орехи');
	await expect(saved.getByLabel(rsvp.telegramLabel)).toHaveValue('@maria_ivanova');
	await expect(saved.getByRole('button', { name: rsvp.save })).toBeVisible();
	// registry is null in wedding.ts, so even an invited family guest gets no registry field.
	await expect(saved.getByText(rsvp.registryLabel, { exact: true })).toHaveCount(0);
});

test('declining hides the menu and keeps the comment', async ({ page }) => {
	await page.goto('/rsvp');
	const answer = form(page);
	await answer.getByLabel(rsvp.attendingNo).check();
	await expect(answer.getByText(rsvp.coursesLabel, { exact: true })).toBeHidden();
	await answer.getByLabel(rsvp.commentLabel).fill('Буду в отъезде');
	await submit(page).click();
	await expect(page).toHaveURL('/thanks');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(thanks.titleNo);
	await expect(page.locator('[data-summary]')).toContainText('Буду в отъезде');
	await expect(page.locator('[data-summary]')).not.toContainText(rsvp.coursesLabel);

	await page.goto('/rsvp');
	await expect(form(page).getByLabel(rsvp.attendingNo)).toBeChecked();
	await expect(form(page).getByLabel(rsvp.commentLabel)).toHaveValue('Буду в отъезде');
});

test('the guest changes the answer from the summary before the deadline', async ({ page }) => {
	await page.goto('/thanks');
	await page.getByRole('link', { name: thanks.edit }).click();
	await expect(page).toHaveURL('/rsvp');

	await form(page).getByLabel(rsvp.attendingYes).check();
	await drink(page).check();
	await submit(page).click();

	await expect(page).toHaveURL('/thanks');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(thanks.titleYes);
	await expect(page.locator('[data-summary]')).toContainText(menu.drinks[0]!.label);

	// Leave the answer as the next test expects it.
	await page.goto('/rsvp');
	await form(page).getByLabel(rsvp.attendingNo).check();
	await submit(page).click();
	await expect(page).toHaveURL('/thanks');
});

test('a forged menu id is refused with a message and nothing changes', async ({ page }) => {
	await page.goto('/rsvp');
	const answer = form(page);
	await answer.getByLabel(rsvp.attendingYes).check();
	await course(page).evaluate((input: HTMLInputElement) => (input.value = 'not-on-the-menu'));
	await course(page).check();
	await submit(page).click();

	await expect(page.getByRole('alert')).toHaveText(rsvp.unknownOption);
	await page.goto('/rsvp');
	await expect(form(page).getByLabel(rsvp.attendingNo)).toBeChecked();
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the form posts as a plain page and saves the answer', async ({ page }) => {
		await page.goto('/rsvp');
		await form(page).getByLabel(rsvp.attendingYes).check();
		await form(page).getByLabel(rsvp.commentLabel).fill('Без JavaScript');
		await submit(page).click();
		await expect(page).toHaveURL('/thanks');

		await page.goto('/rsvp');
		await expect(form(page).getByLabel(rsvp.attendingYes)).toBeChecked();
		await expect(form(page).getByLabel(rsvp.commentLabel)).toHaveValue('Без JavaScript');
	});
});
