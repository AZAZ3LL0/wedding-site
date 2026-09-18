import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

const example = parseEnv(readFileSync('.env.example', 'utf8'));
const db = 'postgres://wedding:wedding@127.0.0.1:5432/wedding';

describe('.env.example', () => {
	it('lists exactly the keys the app reads', () => {
		expect(Object.keys(example).sort()).toEqual(
			[
				'DATABASE_URL',
				'PUBLIC_SITE_URL',
				'ADMIN_PASSWORD',
				'SESSION_SECRET',
				'SHOW_KITCHEN_SINK'
			].sort()
		);
	});

	it('is enough to start the app without real secrets', () => {
		const config = parseConfig({ ...example, NODE_ENV: 'development' });
		expect(config.adminPassword).toBeNull();
		expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
		expect(config.showKitchenSink).toBe(false);
	});
});

describe('parseConfig', () => {
	it('generates a different session secret per start outside production', () => {
		const env = { DATABASE_URL: db };
		expect(parseConfig(env).sessionSecret).not.toBe(parseConfig(env).sessionSecret);
	});

	it('requires the admin password and session secret in production', () => {
		const env = { NODE_ENV: 'production', DATABASE_URL: db };
		expect(() => parseConfig(env)).toThrow(/ADMIN_PASSWORD[\s\S]*SESSION_SECRET/);

		const config = parseConfig({
			...env,
			ADMIN_PASSWORD: 'correct horse battery',
			SESSION_SECRET: 'a'.repeat(64)
		});
		expect(config.adminPassword).toBe('correct horse battery');
		expect(config.sessionSecret).toBe('a'.repeat(64));
	});

	it('opens the kitchen sink only when asked', () => {
		expect(parseConfig({ DATABASE_URL: db }).showKitchenSink).toBe(false);
		expect(parseConfig({ DATABASE_URL: db, SHOW_KITCHEN_SINK: 'true' }).showKitchenSink).toBe(true);
	});

	it('treats empty values as missing', () => {
		expect(() => parseConfig({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
	});

	it('rejects a database URL that is not Postgres', () => {
		expect(() => parseConfig({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
	});

	it('never puts secrets into the error message', () => {
		const env = {
			NODE_ENV: 'production',
			DATABASE_URL: db,
			ADMIN_PASSWORD: 'leak-check'
		};
		expect(() => parseConfig(env)).toThrow();
		try {
			parseConfig(env);
		} catch (error) {
			expect(String(error)).not.toMatch(/leak-check|wedding:wedding/);
		}
	});
});
