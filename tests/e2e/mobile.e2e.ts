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

test('the card keeps the date on one line on a 320 px phone', async ({
	page,
	context,
	baseURL
}) => {
	await signIn(context, baseURL!);
	await page.goto('/i');
	const date = page.locator('[data-card] time').first();
	await expect(date).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	const lines = await date.evaluate(
		(el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)
	);
	expect(lines).toBeLessThan(1.5);
});
