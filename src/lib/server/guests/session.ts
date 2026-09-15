import { randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import type { Db } from '$lib/server/db';
import type { GuestPublic } from '$lib/types';
import { findGuestPublic, findSessionGuestId, insertSession } from './repo';

export const SESSION_COOKIE = 'guest_session';
export const SESSION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export function sessionExpiry(now: Date): Date {
	return new Date(now.getTime() + SESSION_DAYS * DAY_MS);
}

// The shared link is public, so the cookie is the only thing that separates one guest's card
// from another's: 32 random bytes, never derived from the guest.
export function newSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

export async function startSession(
	db: Db,
	cookies: Cookies,
	guestId: string,
	{ secure, now = new Date() }: { secure: boolean; now?: Date }
): Promise<void> {
	const id = newSessionToken();
	const expiresAt = sessionExpiry(now);
	await insertSession(db, { id, guestId, expiresAt });
	cookies.set(SESSION_COOKIE, id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		expires: expiresAt
	});
}

export async function sessionGuest(
	db: Db,
	cookies: Cookies,
	now = new Date()
): Promise<GuestPublic | null> {
	const id = cookies.get(SESSION_COOKIE);
	if (!id) return null;
	const guestId = await findSessionGuestId(db, id, now);
	return guestId ? findGuestPublic(db, guestId) : null;
}
