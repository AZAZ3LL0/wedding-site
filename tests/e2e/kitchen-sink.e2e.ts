import { expect, test } from '@playwright/test';
import { sample } from '../../src/routes/kitchen-sink/fixtures';

// Every public primitive from tech.md §8.
const primitives = [
	'Section',
	'Reveal',
	'Heading',
	'Divider',
	'Countdown',
	'Collage',
	'TimelineItem',
	'MapCard',
	'AudioToggle',
	'Button',
	'Field',
	'TextInput',
	'TextArea',
	'RadioGroup',
	'CheckboxGroup',
	'Toast'
];

test('kitchen-sink applies design tokens and fonts', async ({ page }) => {
	await page.goto('/kitchen-sink');

	await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(243, 235, 228)');
	await expect(page.locator('[data-token="--c-accent"]')).toHaveCSS(
		'background-color',
		'rgb(122, 30, 44)'
	);

	const loaded = await page.evaluate(async () => {
		await document.fonts.ready;
		return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
	});
	expect(new Set(loaded)).toEqual(new Set(['Cormorant Garamond', 'Wedding Script', 'Great Vibes']));
});

test('kitchen-sink renders every primitive from §8', async ({ page }) => {
	await page.goto('/kitchen-sink');

	for (const name of primitives) {
		const block = page.locator(`[data-primitive="${name}"]`);
		await block.scrollIntoViewIfNeeded();
		await expect(block, name).toBeVisible();
		await expect(block.locator('> :not(h2)').first(), name).toBeVisible();
	}
});

test.describe('interactive primitives', () => {
	test('CheckboxGroup stops at max and lets the guest uncheck', async ({ page }) => {
		await page.goto('/kitchen-sink');
		const group = page.locator('[data-primitive="CheckboxGroup"] [role="group"]');
		const boxes = group.getByRole('checkbox');

		await boxes.nth(0).check();
		await boxes.nth(1).check();
		await expect(boxes.nth(2)).toBeDisabled();

		await boxes.nth(0).uncheck();
		await expect(boxes.nth(2)).toBeEnabled();
	});

	test('AudioToggle starts muted and toggles its pressed state', async ({ page }) => {
		await page.goto('/kitchen-sink');
		const toggle = page.locator('[data-primitive="AudioToggle"] button');

		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	});

	test('Field links its label and error to the control', async ({ page }) => {
		await page.goto('/kitchen-sink');
		const inputs = page
			.locator('[data-primitive="Field"]')
			.getByRole('textbox', { name: sample.field.label });

		await expect(inputs).toHaveCount(2);
		await expect(inputs.nth(1)).toHaveAccessibleDescription(sample.field.error);
	});
});

test.describe('reveal', () => {
	const hiddenBlock = '[data-primitive="Reveal"] [data-reveal] >> nth=-1';

	test('animates content in when it scrolls into view', async ({ page }) => {
		await page.goto('/kitchen-sink');
		const block = page.locator(hiddenBlock);

		await expect(block).toHaveCSS('opacity', '0');
		await block.scrollIntoViewIfNeeded();
		await expect(block).toHaveCSS('opacity', '1');
	});

	test.describe('with prefers-reduced-motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('shows content immediately without transforms', async ({ page }) => {
			await page.goto('/kitchen-sink');
			const blocks = page.locator('[data-reveal]');

			for (const block of await blocks.all()) {
				await expect(block).toHaveCSS('opacity', '1');
				await block.scrollIntoViewIfNeeded();
				await page.waitForTimeout(100);
				await expect(block).toHaveCSS('transform', 'none');
				expect(await block.evaluate((el) => el.getAnimations().length)).toBe(0);
			}
		});
	});

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		test('keeps content visible', async ({ page }) => {
			await page.goto('/kitchen-sink');
			for (const block of await page.locator('[data-reveal]').all()) {
				await expect(block).toHaveCSS('opacity', '1');
			}
		});
	});
});
