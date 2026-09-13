import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
// Explicit extension: scripts/seed.ts loads this file with Node's native TypeScript support.
import * as schema from './schema.ts';

export function createDb(connectionString: string) {
	const pool = new pg.Pool({ connectionString, max: 5 });
	return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

export type Db = ReturnType<typeof createDb>['db'];
