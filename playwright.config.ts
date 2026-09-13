import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
	webServer: {
		// CI builds in an earlier step, so only local runs pay for a rebuild.
		command: `${process.env.CI ? '' : 'pnpm build && '}pnpm preview --port 4173 --strictPort`,
		port: 4173,
		reuseExistingServer: !process.env.CI,
		// Preview runs with NODE_ENV=production, which requires these. Throwaway values per run.
		env: {
			SESSION_SECRET: randomBytes(32).toString('hex'),
			ADMIN_PASSWORD: randomBytes(18).toString('base64url')
		}
	}
});
