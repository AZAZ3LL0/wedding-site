import { and, asc, eq, gt } from 'drizzle-orm';
import type { Db } from '$lib/server/db';
import { guestSessions, guests, parties, rsvps } from '$lib/server/db/schema';
import type { GuestPublic } from '$lib/types';
import type { MatchCandidate } from './match';

export async function listMatchCandidates(db: Db): Promise<MatchCandidate[]> {
	return (
		db
			.select({
				guestId: guests.id,
				nameKey: guests.nameKey,
				lastName: guests.lastName,
				audience: parties.audience,
				invitedByGuestId: guests.invitedByGuestId
			})
			.from(guests)
			.innerJoin(parties, eq(guests.partyId, parties.id))
			// A stable order keeps the namesake choice from shuffling between requests.
			.orderBy(asc(guests.createdAt), asc(guests.id))
	);
}

// Selects public columns only, so botToken, telegramChatId and note never leave the database.
export async function findGuestPublic(db: Db, guestId: string): Promise<GuestPublic | null> {
	const [row] = await db
		.select({
			id: guests.id,
			partyId: guests.partyId,
			displayName: guests.displayName,
			firstName: guests.firstName,
			isPlusOne: guests.isPlusOne,
			audience: parties.audience,
			invitedToRegistry: parties.invitedToRegistry,
			plusOnePolicy: parties.plusOnePolicy
		})
		.from(guests)
		.innerJoin(parties, eq(guests.partyId, parties.id))
		.where(eq(guests.id, guestId));
	if (!row) return null;

	const partyMembers = await db
		.select({ id: guests.id, displayName: guests.displayName, isPlusOne: guests.isPlusOne })
		.from(guests)
		.where(eq(guests.partyId, row.partyId))
		.orderBy(asc(guests.isPlusOne), asc(guests.createdAt), asc(guests.id));

	const [rsvp] = await db
		.select({
			attending: rsvps.attending,
			attendingRegistry: rsvps.attendingRegistry,
			mainCourses: rsvps.mainCourses,
			drinks: rsvps.drinks,
			allergies: rsvps.allergies,
			needsTransfer: rsvps.needsTransfer,
			songRequest: rsvps.songRequest,
			comment: rsvps.comment,
			updatedAt: rsvps.updatedAt
		})
		.from(rsvps)
		.where(eq(rsvps.guestId, guestId));

	return {
		id: row.id,
		displayName: row.displayName,
		firstName: row.firstName,
		audience: row.audience,
		invitedToRegistry: row.invitedToRegistry,
		plusOnePolicy: row.plusOnePolicy,
		isPlusOne: row.isPlusOne,
		partyMembers,
		rsvp: rsvp ? { ...rsvp, updatedAt: rsvp.updatedAt.toISOString() } : null
	};
}

export async function insertSession(
	db: Db,
	session: { id: string; guestId: string; expiresAt: Date }
): Promise<void> {
	await db.insert(guestSessions).values(session);
}

export async function findSessionGuestId(db: Db, id: string, now: Date): Promise<string | null> {
	const [row] = await db
		.select({ guestId: guestSessions.guestId })
		.from(guestSessions)
		.where(and(eq(guestSessions.id, id), gt(guestSessions.expiresAt, now)));
	return row?.guestId ?? null;
}

export type NewParty = Omit<typeof parties.$inferInsert, 'id' | 'createdAt'>;
export type NewGuest = Omit<typeof guests.$inferInsert, 'id' | 'partyId' | 'createdAt'>;

// Party and guest land together or not at all, so a failed registration leaves no empty party.
export async function insertPartyWithGuest(
	db: Db,
	party: NewParty,
	guest: NewGuest
): Promise<string> {
	return db.transaction(async (tx) => {
		const [createdParty] = await tx.insert(parties).values(party).returning({ id: parties.id });
		const [createdGuest] = await tx
			.insert(guests)
			.values({ ...guest, partyId: createdParty!.id })
			.returning({ id: guests.id });
		return createdGuest!.id;
	});
}
