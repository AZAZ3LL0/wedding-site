import { asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '$lib/server/db';
import { guests, parties, rsvps } from '$lib/server/db/schema';
import type { AttendStatus, Audience, PlusOnePolicy } from '$lib/types';

// What the organizer sees about one guest. Carries no botToken and no telegramChatId: the panel
// only needs to know whether the bot is connected (tech.md §11).
export type AdminGuestRow = {
	id: string;
	firstName: string;
	lastName: string;
	name: string; // full name, so components never assemble one themselves
	isPlusOne: boolean;
	invitedByName: string | null; // who brings this guest, set for a companion
	companionName: string | null; // whom this guest brings
	partyId: string;
	partyTitle: string;
	audience: Audience;
	plusOnePolicy: PlusOnePolicy;
	invitedToRegistry: boolean;
	telegramUsername: string | null;
	telegramLinked: boolean;
	rsvp: AdminRsvp | null;
};

export type AdminRsvp = {
	attending: AttendStatus;
	attendingRegistry: boolean;
	mainCourses: string[];
	drinks: string[];
	allergies: string | null;
	needsTransfer: boolean;
	comment: string | null;
	updatedAt: string;
};

const fullName = (first: string | null, last: string | null) =>
	first === null ? null : [first, last].filter(Boolean).join(' ');

export async function listGuestRows(db: Db): Promise<AdminGuestRow[]> {
	const inviter = alias(guests, 'inviter');
	const companion = alias(guests, 'companion');

	const rows = await db
		.select({
			id: guests.id,
			firstName: guests.firstName,
			lastName: guests.lastName,
			isPlusOne: guests.isPlusOne,
			inviterFirstName: inviter.firstName,
			inviterLastName: inviter.lastName,
			companionFirstName: companion.firstName,
			companionLastName: companion.lastName,
			partyId: parties.id,
			partyTitle: parties.title,
			audience: parties.audience,
			plusOnePolicy: parties.plusOnePolicy,
			invitedToRegistry: parties.invitedToRegistry,
			telegramUsername: guests.telegramUsername,
			// The chat id itself never leaves the server, only the fact that there is one.
			telegramLinked: sql<boolean>`(${guests.telegramChatId} is not null)`,
			attending: rsvps.attending,
			attendingRegistry: rsvps.attendingRegistry,
			mainCourses: rsvps.mainCourses,
			drinks: rsvps.drinks,
			allergies: rsvps.allergies,
			needsTransfer: rsvps.needsTransfer,
			comment: rsvps.comment,
			updatedAt: rsvps.updatedAt
		})
		.from(guests)
		.innerJoin(parties, eq(guests.partyId, parties.id))
		.leftJoin(rsvps, eq(rsvps.guestId, guests.id))
		.leftJoin(inviter, eq(guests.invitedByGuestId, inviter.id))
		.leftJoin(companion, eq(companion.invitedByGuestId, guests.id))
		// A companion follows the guest who brought them, so the table reads as a list of invitations.
		.orderBy(asc(parties.createdAt), asc(parties.id), asc(guests.isPlusOne), asc(guests.createdAt));

	return rows.map((row) => ({
		id: row.id,
		firstName: row.firstName,
		lastName: row.lastName,
		name: fullName(row.firstName, row.lastName)!,
		isPlusOne: row.isPlusOne,
		invitedByName: fullName(row.inviterFirstName, row.inviterLastName),
		companionName: fullName(row.companionFirstName, row.companionLastName),
		partyId: row.partyId,
		partyTitle: row.partyTitle,
		audience: row.audience,
		plusOnePolicy: row.plusOnePolicy,
		invitedToRegistry: row.invitedToRegistry,
		telegramUsername: row.telegramUsername,
		telegramLinked: row.telegramLinked,
		rsvp:
			row.attending === null
				? null
				: {
						attending: row.attending,
						attendingRegistry: row.attendingRegistry!,
						mainCourses: row.mainCourses!,
						drinks: row.drinks!,
						allergies: row.allergies,
						needsTransfer: row.needsTransfer!,
						comment: row.comment,
						updatedAt: row.updatedAt!.toISOString()
					}
	}));
}

export type PartyPatch = {
	audience: Audience;
	plusOnePolicy: PlusOnePolicy;
	invitedToRegistry: boolean;
};

/**
 * Moves a party between groups and changes its policies. Dropping the registry invitation also
 * drops the registry answers of its guests, keeping invariant 4 of tech.md §4 true.
 */
export async function updateParty(db: Db, partyId: string, patch: PartyPatch): Promise<boolean> {
	return db.transaction(async (tx) => {
		const updated = await tx
			.update(parties)
			.set(patch)
			.where(eq(parties.id, partyId))
			.returning({ id: parties.id });
		if (updated.length === 0) return false;

		if (!patch.invitedToRegistry) {
			await tx
				.update(rsvps)
				.set({ attendingRegistry: false })
				.where(
					sql`${rsvps.guestId} in (select ${guests.id} from ${guests} where ${guests.partyId} = ${partyId})`
				);
		}
		return true;
	});
}

/**
 * Removes a duplicate or an outsider. The RSVP and the sessions go with the guest through
 * ON DELETE CASCADE; the companion the guest declared goes too, and an emptied party with it.
 */
export async function deleteGuest(db: Db, guestId: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ partyId: guests.partyId })
			.from(guests)
			.where(eq(guests.id, guestId));
		if (!row) return false;

		await tx.delete(guests).where(eq(guests.invitedByGuestId, guestId));
		await tx.delete(guests).where(eq(guests.id, guestId));

		const left = await tx
			.select({ id: guests.id })
			.from(guests)
			.where(eq(guests.partyId, row.partyId));
		if (left.length === 0) await tx.delete(parties).where(eq(parties.id, row.partyId));
		return true;
	});
}
