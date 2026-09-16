import type { Cookies } from '@sveltejs/kit';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	ADMIN_COOKIE,
	ADMIN_SESSION_DAYS,
	adminSessionExpiry,
	checkAdminPassword,
	createAdminToken,
	endAdminSession,
	isAdmin,
	startAdminSession,
	verifyAdminToken
} from './auth';

const secret = fc.string({ minLength: 32, maxLength: 64 });
const password = fc.string({ minLength: 1, maxLength: 64 });
const now = new Date('2026-06-01T10:00:00Z');

type CookieOptions = Parameters<Cookies['set']>[2];

function cookieJar() {
	const values = new Map<string, string>();
	const options = new Map<string, CookieOptions>();
	const cookies = {
		get: (name: string) => values.get(name),
		set: (name: string, value: string, opts: CookieOptions) => {
			values.set(name, value);
			options.set(name, opts);
		},
		delete: (name: string) => values.delete(name)
	} as unknown as Cookies;
	return { cookies, values, options };
}

describe('admin password', () => {
	it('accepts only the exact configured password', () => {
		fc.assert(
			fc.property(password, password, (expected, input) => {
				expect(checkAdminPassword(input, expected)).toBe(input === expected);
			})
		);
	});

	it('refuses every password while ADMIN_PASSWORD is unset', () => {
		fc.assert(
			fc.property(fc.string(), (input) => {
				expect(checkAdminPassword(input, null)).toBe(false);
			})
		);
	});
});

describe('admin token', () => {
	it('verifies a token it signed', () => {
		fc.assert(
			fc.property(secret, (value) => {
				const token = createAdminToken(value, adminSessionExpiry(now));
				expect(verifyAdminToken(value, token, now)).toBe(true);
			})
		);
	});

	it('refuses a token signed with another secret', () => {
		fc.assert(
			fc.property(secret, secret, (mine, other) => {
				fc.pre(mine !== other);
				const token = createAdminToken(other, adminSessionExpiry(now));
				expect(verifyAdminToken(mine, token, now)).toBe(false);
			})
		);
	});

	it('refuses a token past its expiry', () => {
		const expiresAt = adminSessionExpiry(now);
		expect(
			verifyAdminToken(
				's'.repeat(32),
				createAdminToken('s'.repeat(32), expiresAt),
				new Date(expiresAt)
			)
		).toBe(false);
	});

	it('expires after the configured number of days', () => {
		expect(adminSessionExpiry(now) - now.getTime()).toBe(ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000);
	});

	it('refuses a token whose expiry was moved forward', () => {
		const key = 's'.repeat(32);
		const token = createAdminToken(key, adminSessionExpiry(now));
		const forged = `${adminSessionExpiry(now) + 1000}.${token.split('.')[1]}`;
		expect(verifyAdminToken(key, forged, now)).toBe(false);
	});

	it('refuses malformed and missing tokens', () => {
		const key = 's'.repeat(32);
		for (const token of [undefined, '', '.', 'nodot', '.signature', 'abc.signature']) {
			expect(verifyAdminToken(key, token, now)).toBe(false);
		}
	});
});

describe('admin session cookie', () => {
	it('signs in and out through the cookie', () => {
		const key = 's'.repeat(32);
		const { cookies, options } = cookieJar();

		startAdminSession(cookies, { secret: key, secure: true, now });
		expect(isAdmin(cookies, key, now)).toBe(true);
		expect(options.get(ADMIN_COOKIE)).toMatchObject({
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true
		});

		endAdminSession(cookies);
		expect(isAdmin(cookies, key, now)).toBe(false);
	});
});
