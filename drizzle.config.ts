import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	// Tooling runs outside the app, so it cannot go through lib/server/config.ts.
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	strict: true
});
