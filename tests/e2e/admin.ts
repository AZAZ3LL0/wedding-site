import { expect, type Page } from '@playwright/test';
import { admin } from '../../src/lib/content/admin';

/**
 * Password for the preview server that playwright.config.ts starts. Throwaway by definition: the
 * server lives for one run against a local database, and the real password comes from the server
 * environment.
 */
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin-password';

export async function signInAsAdmin(page: Page) {
	await page.goto('/admin/login');
	await page.getByLabel(admin.login.passwordLabel).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: admin.login.submit }).click();
	await expect(page).toHaveURL('/admin');
}
