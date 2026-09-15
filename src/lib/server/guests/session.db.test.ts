import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '$lib/server/db';
import { guestSessions } from '$lib/server/db/schema';
import { seed, seedGuests } from '../../../../scripts/seed';
import { match } from './match';
import { findGuestPublic, listMatchCandidates } from './repo';
import { SESSION_COOKIE, SESSION_DAYS, sessionGuest, startSession } from './session';

const { db, close } = createDb(inject('databaseUrl'));
beforeAll(() => seed(db));
afterAll(() => close());

type CookieOptions = Parameters<Cookies['set']>[2];

// Records what the action would send to the browser and replays it on the next request.
function cookieJar() {
	const values = new Map<string, string>();
	const options = new Map<string, CookieOptions>();
	const cookies = {
		get: (name: string) => values.get(name),
		set: (name: string, value: string, opts: CookieOptions) => {
			values.set(name, value);
			options.set(name, opts);
		}
	} as unknown as Cookies;
	return { cookies, values, options };
}

const byName = (firstName: string, lastName: string) =>
	seedGuests.find((g) => g.firstName === firstName && g.lastName === lastName)!;

const labels = { family: 'родные', friends: 'друзья', colleagues: 'коллеги' };

describe('guest repo', () => {
	it('returns exactly the GuestPublic shape, without secrets', async () => {
		const ivan = byName('Иван', 'Иванов');
		const guest = await findGuestPublic(db, ivan.id);

		expect(Object.keys(guest!).sort()).toEqual(
			[
				'id',
				'displayName',
				'firstName',
				'audience',
				'invitedToRegistry',
				'plusOnePolicy',
				'isPlusOne',
				'partyMembers',
				'rsvp'
			].sort()
		);
		expect(guest).toMatchObject({
			id: ivan.id,
			displayName: 'Иван',
			audience: 'family',
			invitedToRegistry: true,
			plusOnePolicy: 'none',
			isPlusOne: false,
			rsvp: null
		});
		expect(guest!.partyMembers.map((m) => m.displayName).sort()).toEqual(['Иван', 'Мария']);

		const serialized = JSON.stringify(guest);
		expect(serialized).not.toContain(ivan.botToken);
		expect(serialized).not.toContain(String(ivan.telegramChatId));
		expect(serialized).not.toMatch(/botToken|telegramChatId|note/);
	});

	it('returns null for a guest that does not exist', async () => {
		expect(await findGuestPublic(db, '00000000-0000-4000-8000-00000000ffff')).toBeNull();
	});

	it('feeds match with every guest, so namesakes in the database get a choice', async () => {
		const result = match('Анна Сидорова', await listMatchCandidates(db), labels);
		expect(result.kind).toBe('ambiguous');
	});
});

describe('guest session', () => {
	const now = new Date('2026-09-15T12:00:00Z');
	const petrov = byName('Алексей', 'Петров');

	it('sets a 90-day http-only cookie that finds the same guest on the next request', async () => {
		const jar = cookieJar();
		await startSession(db, jar.cookies, petrov.id, { secure: true, now });

		const token = jar.values.get(SESSION_COOKIE)!;
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(jar.options.get(SESSION_COOKIE)).toEqual({
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			expires: new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
		});

		const [row] = await db.select().from(guestSessions).where(eq(guestSessions.id, token));
		expect(row).toMatchObject({ guestId: petrov.id });

		const guest = await sessionGuest(db, jar.cookies, now);
		expect(guest?.id).toBe(petrov.id);
	});

	it('gives every sign-in its own token', async () => {
		const first = cookieJar();
		const second = cookieJar();
		await startSession(db, first.cookies, petrov.id, { secure: false, now });
		await startSession(db, second.cookies, petrov.id, { secure: false, now });
		expect(first.values.get(SESSION_COOKIE)).not.toBe(second.values.get(SESSION_COOKIE));
	});

	it('treats an expired session as no session', async () => {
		const jar = cookieJar();
		await startSession(db, jar.cookies, petrov.id, { secure: false, now });

		const lastMoment = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000 - 1);
		const expired = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
		expect(await sessionGuest(db, jar.cookies, lastMoment)).not.toBeNull();
		expect(await sessionGuest(db, jar.cookies, expired)).toBeNull();
	});

	it('treats a missing or forged cookie as no session', async () => {
		expect(await sessionGuest(db, cookieJar().cookies, now)).toBeNull();

		const forged = cookieJar();
		forged.values.set(SESSION_COOKIE, petrov.id);
		expect(await sessionGuest(db, forged.cookies, now)).toBeNull();
	});
});
