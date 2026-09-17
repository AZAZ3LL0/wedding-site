import { expect, test } from '@playwright/test';
import { signIn } from './guest';

// The narrowest phone still in use; everything wider has more room.
test.use({ viewport: { width: 320, height: 640 } });

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('no page scrolls sideways on a 320 px phone', async ({ page, context, baseURL }) => {
	await page.goto('/');
	await signIn(context, baseURL!);
	for (const path of ['/', '/i', '/rsvp']) {
		if (path !== '/') await page.goto(path);
		await page.evaluate(() => document.fonts.ready);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, path).toBeLessThanOrEqual(0);
	}
});

test('the arch keeps every date line whole on a 320 px phone', async ({
	page,
	context,
	baseURL
}) => {
	await signIn(context, baseURL!);
	await page.goto('/i');
	const lines = page.locator('[data-card] time span');
	await expect(lines.first()).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	// Day, month and year: each is one line, and none of them is wider than the arch.
	await expect(lines).toHaveCount(3);
	for (const line of await lines.all()) {
		const { rows, fits } = await line.evaluate((el) => ({
			rows: el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
			fits: el.getBoundingClientRect().width <= el.closest('[data-card]')!.clientWidth
		}));
		expect(rows).toBeLessThan(1.5);
		expect(fits).toBe(true);
	}
});
