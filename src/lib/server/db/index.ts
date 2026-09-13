import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { getConfig } from '../config.ts';
// Explicit extension: scripts/seed.ts loads this file with Node's native TypeScript support.
import * as schema from './schema.ts';

export function createDb(connectionString: string) {
	const pool = new pg.Pool({ connectionString, max: 5 });
	return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

export type Db = ReturnType<typeof createDb>['db'];

let shared: Db | undefined;

// The app-wide pool. Scripts and tests create their own with createDb.
export function getDb(): Db {
	shared ??= createDb(getConfig().databaseUrl).db;
	return shared;
}
