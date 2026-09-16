import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { admin } from '../../src/lib/content/admin';
import { ADMIN_PASSWORD, signInAsAdmin } from './admin';

// Letters only, so every run works on a guest no other suite touches.
function newcomer() {
	const letters = 'абвгдежзиклмнопрстуфхцчшэюя';
	const suffix = Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * 26)]).join('');
	return { firstName: 'Гость', lastName: `Разовый${suffix}` };
}

async function registerGuest(context: BrowserContext, baseURL: string) {
	const name = newcomer();
	const response = await context.request.post(`${baseURL}/?/register`, {
		form: name,
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	return name;
}

async function search(page: Page, term: string) {
	await page.getByLabel(admin.filters.search).fill(term);
	await page.getByRole('button', { name: admin.filters.apply }).click();
}

const notice = (page: Page) => page.getByRole('status');

test('keeps the panel and the export behind the password', async ({ page }) => {
	await page.goto('/admin');
	await expect(page).toHaveURL('/admin/login');

	const download = await page.request.get('/admin/export');
	expect(download.status()).toBe(404);
});

test('refuses a wrong password and accepts the right one', async ({ page }) => {
	await page.goto('/admin/login');
	await page.getByLabel(admin.login.passwordLabel).fill(`${ADMIN_PASSWORD}-wrong`);
	await page.getByRole('button', { name: admin.login.submit }).click();

	await expect(page.getByText(admin.login.failed)).toBeVisible();
	await expect(page).toHaveURL('/admin/login');

	await signInAsAdmin(page);
	await expect(page.getByRole('heading', { name: admin.title })).toBeVisible();
});

test('shows the counters, the guest table and the filters', async ({ page, context, baseURL }) => {
	const guest = await registerGuest(context, baseURL!);
	await signInAsAdmin(page);

	await expect(page.getByText(admin.stats.attending, { exact: true })).toBeVisible();
	await expect(page.getByText(admin.stats.allergies, { exact: true })).toBeVisible();

	await search(page, guest.lastName);
	const rows = page.getByRole('table').getByRole('row');
	await expect(rows).toHaveCount(2); // header plus the one guest
	await expect(rows.nth(1)).toContainText(`${guest.firstName} ${guest.lastName}`);
	await expect(rows.nth(1)).toContainText(admin.status.none);

	// A guest without an answer is out of the "coming" filter.
	await page.getByLabel(admin.filters.status).selectOption('yes');
	await page.getByRole('button', { name: admin.filters.apply }).click();
	await expect(page.getByText(admin.table.empty)).toBeVisible();
});

test('moves a guest to another group and removes them', async ({ page, context, baseURL }) => {
	const guest = await registerGuest(context, baseURL!);
	await signInAsAdmin(page);
	await search(page, guest.lastName);

	const row = page.getByRole('table').getByRole('row').nth(1);
	await row.getByLabel(admin.table.audience).selectOption('family');
	await row.getByRole('button', { name: admin.party.save }).click();

	await expect(notice(page)).toHaveText(admin.party.saved);
	await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText(
		admin.audience.family
	);

	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: admin.party.delete }).click();

	await expect(notice(page)).toHaveText(admin.party.deleted);
	await expect(page.getByText(admin.table.empty)).toBeVisible();
});

test('downloads the guest list as xlsx and signs out', async ({ page }) => {
	await signInAsAdmin(page);

	const file = await page.request.get('/admin/export');
	expect(file.status()).toBe(200);
	expect(file.headers()['content-type']).toContain('spreadsheetml.sheet');
	expect(file.headers()['content-disposition']).toMatch(
		/attachment; filename="guests-\d{4}-\d{2}-\d{2}\.xlsx"/
	);
	expect((await file.body()).byteLength).toBeGreaterThan(0);

	await page.getByRole('button', { name: admin.nav.signOut }).click();
	await expect(page).toHaveURL('/admin/login');

	await page.goto('/admin');
	await expect(page).toHaveURL('/admin/login');
});
