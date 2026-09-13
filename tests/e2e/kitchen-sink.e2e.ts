import { expect, test } from '@playwright/test';

test('kitchen-sink applies design tokens and fonts', async ({ page }) => {
	await page.goto('/kitchen-sink');

	await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(247, 247, 245)');
	await expect(page.locator('[data-token="--c-forest"]')).toHaveCSS(
		'background-color',
		'rgb(18, 53, 44)'
	);

	const loaded = await page.evaluate(async () => {
		await document.fonts.ready;
		return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
	});
	expect(new Set(loaded)).toEqual(new Set(['Cormorant Garamond', 'Great Vibes', 'Manrope']));
});
