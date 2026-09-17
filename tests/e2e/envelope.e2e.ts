import { expect, test, type Page } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';
import { signIn } from './guest';

test.beforeEach(({ context, baseURL }) => signIn(context, baseURL!));

const envelope = (page: Page) => page.getByRole('dialog');
// Main content and footer share one wrapper that goes inert under the envelope.
const pageContent = (page: Page) => page.locator('div:has(> main)');
const openButton = (page: Page) => page.getByRole('button', { name: content.envelope.open });
const coverHeading = (page: Page) =>
	page.getByRole('heading', { level: 1, name: content.cover.title });

test('meets a visitor without a session before the name form, then hands over to it', async ({
	browser
}) => {
	// A clean context: no guest cookie, so the site opens on the entry page, not on /i.
	const context = await browser.newContext(test.info().project.use);
	const page = await context.newPage();
	await page.goto('/');

	await expect(envelope(page)).toBeVisible();
	await expect(page.locator('main')).toHaveAttribute('inert');
	await openButton(page).click();

	await expect(envelope(page)).toBeHidden();
	await expect(page.locator('main')).not.toHaveAttribute('inert');
	await expect(page.getByLabel(content.entry.firstNameLabel)).toBeVisible();
	await context.close();
});

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

// The arch's velvet and lace wait for the envelope to be on screen; they must still arrive.
const cloth = (page: Page) =>
	page.locator('.cloth').evaluate((el) => {
		const style = getComputedStyle(el);
		return { velvet: style.backgroundImage, lace: style.maskImage };
	});

test('dresses the arch in velvet and lace once opened, and at once on a return visit', async ({
	page
}) => {
	await page.goto('/i');
	await openButton(page).click();
	await expect(envelope(page)).toBeHidden();
	expect(await cloth(page)).toEqual({
		velvet: expect.stringContaining('velvet.jpg'),
		lace: expect.stringContaining('lace-mask.png')
	});

	await page.reload();
	await expect(page.locator('[data-card]')).toBeVisible();
	expect(await cloth(page)).toEqual({
		velvet: expect.stringContaining('velvet.jpg'),
		lace: expect.stringContaining('lace-mask.png')
	});
});

test('opens from the keyboard', async ({ page }) => {
	await page.goto('/i');
	await expect(envelope(page)).toBeVisible();

	// The seal itself is the labelled button, so Tab lands on it.
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

	const baseURL = test.info().project.use.baseURL!;
	const other = await context.browser()!.newContext();
	await signIn(other, baseURL);
	const fresh = await other.newPage();
	await fresh.goto(`${baseURL}/i`);
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

	test('drops hover transitions too', async ({ page }) => {
		await page.goto('/i');
		const link = page.getByRole('link', { name: content.ui.map.open });
		const duration = await link.evaluate((el) =>
			parseFloat(getComputedStyle(el).transitionDuration)
		);
		expect(duration).toBeLessThan(0.001);
	});
});
