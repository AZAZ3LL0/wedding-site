import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';

const envelope = (page: Page) => page.getByRole('dialog');
// Main content and footer share one wrapper that goes inert under the envelope.
const pageContent = (page: Page) => page.locator('div:has(> main)');
const openButton = (page: Page) => page.getByRole('button', { name: content.envelope.open });
const coverHeading = (page: Page) =>
	page.getByRole('heading', { level: 1, name: content.cover.title });

test('covers the card on the first visit and keeps the page from scrolling', async ({ page }) => {
	await page.goto('/i');

	await expect(envelope(page)).toBeVisible();
	await expect(envelope(page)).toHaveAccessibleName(content.envelope.title);
	await expect(pageContent(page)).toHaveAttribute('inert');
	await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
});

test('opens with a tap and hands focus to the invitation', async ({ page }) => {
	await page.goto('/i');
	await openButton(page).click();

	await expect(envelope(page)).toBeHidden();
	await expect(pageContent(page)).not.toHaveAttribute('inert');
	await expect(page.locator('main')).toBeFocused();
	await expect(coverHeading(page)).toBeVisible();
});

test('opens from the keyboard', async ({ page }) => {
	await page.goto('/i');
	await expect(envelope(page)).toBeVisible();

	// The seal is a pointer target only, so Tab lands on the labelled button.
	for (
		let i = 0;
		i < 5 && !(await openButton(page).evaluate((b) => b === document.activeElement));
		i++
	) {
		await page.keyboard.press('Tab');
	}
	await expect(openButton(page)).toBeFocused();
	await page.keyboard.press('Enter');

	await expect(envelope(page)).toBeHidden();
});

test('stays open when the guest reloads the same tab, and returns in a new one', async ({
	page,
	context
}) => {
	await page.goto('/i');
	await openButton(page).click();
	await expect(envelope(page)).toBeHidden();

	await page.reload();
	// Checked before hydration too: the inline script hides it before the first paint.
	await expect(page.locator('html')).toHaveClass(/envelope-opened/);
	await expect(envelope(page)).toBeHidden();

	const other = await context.browser()!.newContext();
	const fresh = await other.newPage();
	await fresh.goto(`${test.info().project.use.baseURL}/i`);
	await expect(envelope(fresh)).toBeVisible();
	await other.close();
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('shows the card straight away', async ({ page }) => {
		await page.goto('/i');
		await expect(envelope(page)).toBeHidden();
		await expect(coverHeading(page)).toBeVisible();
	});
});

test.describe('with prefers-reduced-motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('skips the envelope and leaves the page interactive', async ({ page }) => {
		await page.goto('/i');
		await expect(coverHeading(page)).toBeVisible();
		await expect(envelope(page)).toBeHidden();
		await expect(pageContent(page)).not.toHaveAttribute('inert');
	});
});
