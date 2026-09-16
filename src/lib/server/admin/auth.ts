// Admin access, tech.md §13 task 4.1: one password from env, a cookie signed with SESSION_SECRET.
// There is no admin row in the database, so the cookie carries its own expiry and signature.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_SESSION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// Both sides are hashed first: timingSafeEqual throws on a length mismatch, and the length of a
// password is not something a comparison should leak.
function equals(a: string, b: string): boolean {
	const digest = (value: string) => createHmac('sha256', 'compare').update(value).digest();
	return timingSafeEqual(digest(a), digest(b));
}

function sign(secret: string, expiresAt: number): string {
	return createHmac('sha256', secret).update(`admin:${expiresAt}`).digest('base64url');
}

export function adminSessionExpiry(now: Date): number {
	return now.getTime() + ADMIN_SESSION_DAYS * DAY_MS;
}

export function createAdminToken(secret: string, expiresAt: number): string {
	return `${expiresAt}.${sign(secret, expiresAt)}`;
}

/** A token is valid while the signature matches the expiry it carries and that expiry is ahead. */
export function verifyAdminToken(secret: string, token: string | undefined, now: Date): boolean {
	if (!token) return false;
	const dot = token.indexOf('.');
	if (dot < 1) return false;
	const expiresAt = Number(token.slice(0, dot));
	if (!Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return false;
	return equals(token.slice(dot + 1), sign(secret, expiresAt));
}

/**
 * Checks the password from the login form. An unset ADMIN_PASSWORD closes the panel instead of
 * opening it: outside production the variable is optional (tech.md §10).
 */
export function checkAdminPassword(input: string, expected: string | null): boolean {
	// Still compares, so a missing password takes the same time as a wrong one.
	return equals(input, expected ?? randomBytes(32).toString('hex')) && expected !== null;
}

export function startAdminSession(
	cookies: Cookies,
	{ secret, secure, now = new Date() }: { secret: string; secure: boolean; now?: Date }
): void {
	const expiresAt = adminSessionExpiry(now);
	cookies.set(ADMIN_COOKIE, createAdminToken(secret, expiresAt), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		expires: new Date(expiresAt)
	});
}

export function endAdminSession(cookies: Cookies): void {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}

export function isAdmin(cookies: Cookies, secret: string, now = new Date()): boolean {
	return verifyAdminToken(secret, cookies.get(ADMIN_COOKIE), now);
}
