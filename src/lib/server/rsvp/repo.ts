import { eq, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import type { GuestPublic } from '$lib/types';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type LockedGuest = Pick<
	GuestPublic,
	'id' | 'displayName' | 'audience' | 'invitedToRegistry' | 'plusOnePolicy'
> & { partyId: string };

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
