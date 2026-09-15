import { expect, test } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';

// These checks are about the card, not the envelope that covers it on a first visit.
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

test('invitation card shows the event from the content config', async ({ page }) => {
	await page.goto('/i');

	const card = page.locator('header');
	await expect(card.getByRole('heading', { level: 1 })).toHaveText(content.cover.title);
	await expect(card.getByText(content.cover.eyebrow)).toBeVisible();
	await expect(card.getByText(content.cover.text)).toBeVisible();
	await expect(card.getByRole('img', { name: content.cover.photo.alt })).toBeVisible();
	await expect(card.locator(`time[datetime="${content.event.date}"]`)).toHaveText('28 | 11 | 2026');

	await expect(page.getByText(content.invitation.text)).toBeVisible();
	await expect(page.getByText(content.invitation.dateLine)).toBeVisible();
	// The countdown aims at the local start in Astrakhan, not at the guest's time zone.
	await expect(page.locator('time[datetime="2026-11-28T17:00:00+04:00"]')).toBeVisible();
});

test('sound is off until the guest turns it on', async ({ page }) => {
	await page.goto('/i');
	const toggle = page.getByRole('button', { name: content.ui.audio.play });
	const audio = page.locator('audio');

	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await expect(audio).not.toHaveAttribute('autoplay');
	await expect(audio).toHaveAttribute('preload', 'none');
	await page.waitForLoadState('load');
	expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
});

test.describe('performance', () => {
	// Lighthouse's mobile profile: 4x slower CPU, 150 ms RTT, 1.6 Mbps down, 750 kbps up.
	test('first screen paints its largest element within 2.5 s on a throttled phone', async ({
		browser
	}) => {
		// A first visit, so the envelope is the screen being measured.
		const context = await browser.newContext(test.info().project.use);
		const page = await context.newPage();
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		await cdp.send('Network.enable');
		await cdp.send('Network.emulateNetworkConditions', {
			offline: false,
			latency: 150,
			downloadThroughput: (1.6 * 1024 * 1024) / 8,
			uploadThroughput: (750 * 1024) / 8
		});

		await page.goto(`${test.info().project.use.baseURL}/i`, { waitUntil: 'load' });
		const lcp = await page.evaluate(
			() =>
				new Promise<number>((resolve) => {
					let latest = 0;
					new PerformanceObserver((list) => {
						for (const entry of list.getEntries()) latest = entry.startTime;
					}).observe({ type: 'largest-contentful-paint', buffered: true });
					// Fonts swap after load; give the last candidate time to report.
					setTimeout(() => resolve(latest), 1500);
				})
		);

		await context.close();
		expect(lcp).toBeGreaterThan(0);
		expect(lcp).toBeLessThan(2500);
	});
});

test('location section links the venue to the map and has no registry', async ({ page }) => {
	await page.goto('/i');
	const section = page.getByRole('region', { name: content.sections.location.title });

	const venue = section.locator('[data-place="venue"]');
	await venue.scrollIntoViewIfNeeded();
	await expect(venue.getByRole('heading', { name: content.venue.title })).toBeVisible();
	await expect(venue.getByText(content.venue.address)).toBeVisible();
	await expect(
		venue.getByText(`${content.sections.location.venueStart} ${content.venue.startTime}`)
	).toBeVisible();

	const link = venue.getByRole('link', { name: content.ui.map.open });
	await expect(link).toHaveAttribute('href', content.venue.mapUrl);
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', /noopener/);

	// registry is null in wedding.ts: the day has no civil ceremony.
	await expect(section.locator('[data-place="registry"]')).toHaveCount(0);
});
