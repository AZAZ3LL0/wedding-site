import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';
import { signIn } from './guest';

const { rsvp, thanks, menu } = content;

// Seed guest whose party allows a plus one; no other suite writes his answer.
const INVITER = 'Алексей Петров';
const INVITER_DISPLAY_NAME = 'Лёша';

const form = (page: Page) => page.getByRole('form', { name: rsvp.title });
const submit = (page: Page) =>
	form(page).getByRole('button', { name: new RegExp(`^(${rsvp.submit}|${rsvp.save})$`) });
const toggle = (page: Page) => form(page).getByLabel(rsvp.companionOption);
const companionName = (page: Page) => form(page).getByLabel(rsvp.companionFirstName);

async function answerWithCompanion(page: Page, firstName: string, lastName: string) {
	await page.goto('/rsvp');
	await form(page).getByLabel(rsvp.attendingYes).check();
	await toggle(page).check();
	await companionName(page).fill(firstName);
	await form(page).getByLabel(rsvp.companionLastName).fill(lastName);
	await form(page)
		.getByRole('radiogroup', { name: rsvp.companionCourses })
		.getByLabel(menu.courses[0]!.label)
		.check();
	await submit(page).click();
	await expect(page).toHaveURL('/thanks');
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('a guest without a plus one sees no companion block', async ({ page, context, baseURL }) => {
	await signIn(context, baseURL!, 'Иван Иванов');
	await page.goto('/rsvp');
	await expect(form(page).getByLabel(rsvp.attendingYes)).toBeVisible();
	await expect(toggle(page)).toHaveCount(0);
});

test.describe('a couple', () => {
	test.beforeEach(async ({ context, baseURL }) => {
		await signIn(context, baseURL!, INVITER);
	});

	test('the companion block opens with the toggle and is saved with the answer', async ({
		page
	}) => {
		await page.goto('/rsvp');
		await form(page).getByLabel(rsvp.attendingYes).check();
		await toggle(page).uncheck();
		await expect(companionName(page)).toBeHidden();
		await toggle(page).check();
		await expect(companionName(page)).toBeVisible();

		await answerWithCompanion(page, 'Ольга', 'Смирнова');
		const companion = page.locator('[data-companion]');
		await expect(companion).toContainText(thanks.companionTitle);
		await expect(companion).toContainText('Ольга Смирнова');
		await expect(companion).toContainText(menu.courses[0]!.label);

		await page.goto('/rsvp');
		await expect(toggle(page)).toBeChecked();
		await expect(companionName(page)).toHaveValue('Ольга');
		await expect(form(page).getByLabel(rsvp.companionLastName)).toHaveValue('Смирнова');
		await expect(
			form(page)
				.getByRole('radiogroup', { name: rsvp.companionCourses })
				.getByLabel(menu.courses[0]!.label)
		).toBeChecked();
	});

	test('the companion name opens the inviter card, not a card of their own', async ({
		page,
		context,
		baseURL
	}) => {
		await context.clearCookies();
		await signIn(context, baseURL!, 'Ольга Смирнова');
		await page.goto('/i');
		const welcome = page.locator('[data-welcome]');
		await welcome.scrollIntoViewIfNeeded();
		await expect(welcome).toContainText(INVITER_DISPLAY_NAME);
	});

	test('sending again updates the one companion', async ({ page }) => {
		await answerWithCompanion(page, 'Оля', 'Смирнова');

		await page.goto('/rsvp');
		await expect(companionName(page)).toHaveValue('Оля');
	});

	test('a blank companion name is refused next to the field', async ({ page }) => {
		await page.goto('/rsvp');
		await form(page).getByLabel(rsvp.attendingYes).check();
		await toggle(page).check();
		await companionName(page).fill('   ');
		await submit(page).click();

		await expect(page.getByText(rsvp.companionNameRequired)).toBeVisible();
		await expect(companionName(page)).toHaveAttribute('aria-invalid', 'true');
	});

	test('declining removes the companion', async ({ page }) => {
		await page.goto('/rsvp');
		await form(page).getByLabel(rsvp.attendingNo).check();
		await expect(toggle(page)).toBeHidden();
		await submit(page).click();
		await expect(page).toHaveURL('/thanks');
		await expect(page.locator('[data-companion]')).toHaveCount(0);

		await page.goto('/rsvp');
		await form(page).getByLabel(rsvp.attendingYes).check();
		await expect(toggle(page)).not.toBeChecked();
		await toggle(page).check();
		await expect(companionName(page)).toHaveValue('');
	});
});
