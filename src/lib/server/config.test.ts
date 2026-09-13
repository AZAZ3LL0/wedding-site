import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

const example = parseEnv(readFileSync('.env.example', 'utf8'));
const db = 'postgres://wedding:wedding@127.0.0.1:5432/wedding';

describe('.env.example', () => {
	it('lists exactly the keys from tech.md §10', () => {
		expect(Object.keys(example).sort()).toEqual(
			[
				'DATABASE_URL',
				'PUBLIC_SITE_URL',
				'TELEGRAM_BOT_TOKEN',
				'TELEGRAM_BOT_USERNAME',
				'TELEGRAM_WEBHOOK_SECRET',
				'TELEGRAM_ADMIN_CHAT_ID',
				'ADMIN_PASSWORD',
				'SESSION_SECRET',
				'USE_FAKE_TELEGRAM'
			].sort()
		);
	});

	it('is enough to start the app without real secrets', () => {
		const config = parseConfig({ ...example, NODE_ENV: 'development' });
		expect(config.telegram.useFake).toBe(true);
		expect(config.adminPassword).toBeNull();
		expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
	});
});

describe('parseConfig', () => {
	it('generates a different session secret per start outside production', () => {
		const env = { DATABASE_URL: db, USE_FAKE_TELEGRAM: 'true' };
		expect(parseConfig(env).sessionSecret).not.toBe(parseConfig(env).sessionSecret);
	});

	it('requires the admin password and session secret in production', () => {
		const env = { NODE_ENV: 'production', DATABASE_URL: db, USE_FAKE_TELEGRAM: 'true' };
		expect(() => parseConfig(env)).toThrow(/ADMIN_PASSWORD[\s\S]*SESSION_SECRET/);

		const config = parseConfig({
			...env,
			ADMIN_PASSWORD: 'correct horse battery',
			SESSION_SECRET: 'a'.repeat(64)
		});
		expect(config.adminPassword).toBe('correct horse battery');
		expect(config.sessionSecret).toBe('a'.repeat(64));
	});

	it('requires every Telegram variable when the real client is on', () => {
		const env = { DATABASE_URL: db, USE_FAKE_TELEGRAM: 'false' };
		expect(() => parseConfig(env)).toThrow(/TELEGRAM_BOT_TOKEN/);

		const config = parseConfig({
			...env,
			TELEGRAM_BOT_TOKEN: '123:abc',
			TELEGRAM_BOT_USERNAME: 'wedding_bot',
			TELEGRAM_WEBHOOK_SECRET: 'secret',
			TELEGRAM_ADMIN_CHAT_ID: '-100123'
		});
		expect(config.telegram).toMatchObject({ useFake: false, adminChatId: -100123 });
	});

	it('treats empty values as missing', () => {
		expect(() => parseConfig({ DATABASE_URL: '', USE_FAKE_TELEGRAM: 'true' })).toThrow(
			/DATABASE_URL/
		);
	});

	it('rejects a database URL that is not Postgres', () => {
		expect(() =>
			parseConfig({ DATABASE_URL: 'mysql://localhost/db', USE_FAKE_TELEGRAM: 'true' })
		).toThrow(/DATABASE_URL/);
	});

	it('never puts secrets into the error message', () => {
		const env = {
			NODE_ENV: 'production',
			DATABASE_URL: db,
			USE_FAKE_TELEGRAM: 'false',
			TELEGRAM_BOT_TOKEN: 'super-secret-token',
			ADMIN_PASSWORD: 'leak-check'
		};
		expect(() => parseConfig(env)).toThrow();
		try {
			parseConfig(env);
		} catch (error) {
			expect(String(error)).not.toMatch(/super-secret-token|leak-check|wedding:wedding/);
		}
	});
});
