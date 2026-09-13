import { randomBytes } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
	export interface ProvidedContext {
		databaseUrl: string;
	}
}

// Matches compose.dev.yml; CI passes its service container through DATABASE_URL.
const baseUrl = process.env.DATABASE_URL ?? 'postgres://wedding:wedding@127.0.0.1:55432/wedding';

// Every run migrates a brand-new database from zero, so tests never depend on leftover state.
export default async function setup(project: TestProject) {
	const name = `wedding_test_${randomBytes(6).toString('hex')}`;
	const admin = new pg.Client({ connectionString: baseUrl });
	await admin.connect();
	await admin.query(`CREATE DATABASE ${name}`);

	const url = new URL(baseUrl);
	url.pathname = `/${name}`;
	const pool = new pg.Pool({ connectionString: url.toString() });
	await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
	await pool.end();

	project.provide('databaseUrl', url.toString());

	return async () => {
		await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
		await admin.end();
	};
}
