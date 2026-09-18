import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import type { GuestPublic, RsvpPayload } from '$lib/types';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type LockedGuest = Pick<
	GuestPublic,
	'id' | 'displayName' | 'audience' | 'invitedToRegistry' | 'plusOnePolicy'
> & { partyId: string };

export type Companion = NonNullable<RsvpPayload['companion']>;

export type RsvpRow = Omit<
	typeof rsvps.$inferInsert,
	'id' | 'guestId' | 'source' | 'submittedAt' | 'updatedAt'
>;

/**
 * Runs `fn` in a transaction that holds the guest row lock (tech.md §6), so two submissions of
 * one guest run one after another. `fn` receives null when the guest is gone.
 */
export async function withLockedGuest<T>(
	db: Db,
	guestId: string,
	fn: (tx: Tx, guest: LockedGuest | null) => Promise<T>
): Promise<T> {
	return db.transaction(async (tx) => {
		const [guest] = await tx
			.select({
				id: guests.id,
				partyId: guests.partyId,
				displayName: guests.displayName,
				audience: parties.audience,
				invitedToRegistry: parties.invitedToRegistry,
				plusOnePolicy: parties.plusOnePolicy
			})
			.from(guests)
			.innerJoin(parties, eq(guests.partyId, parties.id))
			.where(eq(guests.id, guestId))
			.for('update', { of: guests });
		return fn(tx, guest ?? null);
	});
}

export async function upsertRsvp(
	tx: Tx,
	guestId: string,
	row: RsvpRow,
	source: string
): Promise<{ created: boolean; updatedAt: Date }> {
	const [saved] = await tx
		.insert(rsvps)
		.values({ ...row, guestId, source })
		.onConflictDoUpdate({
			target: rsvps.guestId,
			// now() is the transaction start, which can predate the lock this update waited for.
			set: { ...row, source, updatedAt: sql`clock_timestamp()` }
		})
		// A fresh insert has no previous row version, which Postgres exposes as xmax = 0.
		.returning({ created: sql<boolean>`(xmax = 0)`, updatedAt: rsvps.updatedAt });
	return saved!;
}

export async function setTelegramUsername(
	tx: Tx,
	guestId: string,
	telegramUsername: string | null
): Promise<void> {
	await tx.update(guests).set({ telegramUsername }).where(eq(guests.id, guestId));
}

export async function findTelegramUsername(db: Db, guestId: string): Promise<string | null> {
	const [row] = await db
		.select({ telegramUsername: guests.telegramUsername })
		.from(guests)
		.where(eq(guests.id, guestId));
	return row?.telegramUsername ?? null;
}

/**
 * Creates or renames the one companion of `inviter` (tech.md §4, invariants 1 and 2). Callers
 * hold the inviter lock, so looking the companion up first cannot race another insert.
 */
export async function upsertCompanion(
	tx: Tx,
	inviter: Pick<LockedGuest, 'id' | 'partyId'>,
	companion: Pick<Companion, 'firstName' | 'lastName'>
): Promise<string> {
	const names = {
		firstName: companion.firstName,
		lastName: companion.lastName,
		displayName: companion.firstName,
		nameKey: nameKey(`${companion.firstName} ${companion.lastName}`)
	};
	const [existing] = await tx
		.select({ id: guests.id })
		.from(guests)
		.where(eq(guests.invitedByGuestId, inviter.id));
	if (existing) {
		await tx
			.update(guests)
			.set({ ...names, partyId: inviter.partyId, isPlusOne: true })
			.where(eq(guests.id, existing.id));
		return existing.id;
	}

	const [created] = await tx
		.insert(guests)
		.values({
			...names,
			partyId: inviter.partyId,
			isPlusOne: true,
			invitedByGuestId: inviter.id,
			// The companion never signs in with it, but the column is required and unique.
			botToken: randomBytes(32).toString('base64url')
		})
		.returning({ id: guests.id });
	return created!.id;
}

// Removes the companion row; its RSVP and sessions go with it through ON DELETE CASCADE.
export async function deleteCompanion(tx: Tx, inviterId: string): Promise<void> {
	await tx.delete(guests).where(eq(guests.invitedByGuestId, inviterId));
}

export async function findCompanion(db: Db, inviterId: string): Promise<Companion | null> {
	const [row] = await db
		.select({
			firstName: guests.firstName,
			lastName: guests.lastName,
			mainCourses: rsvps.mainCourses,
			drinks: rsvps.drinks
		})
		.from(guests)
		.leftJoin(rsvps, eq(rsvps.guestId, guests.id))
		.where(eq(guests.invitedByGuestId, inviterId));
	if (!row) return null;
	return { ...row, mainCourses: row.mainCourses ?? [], drinks: row.drinks ?? [] };
}
