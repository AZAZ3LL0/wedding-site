import { randomBytes } from 'node:crypto';
import type { Db } from '$lib/server/db';
import { insertPartyWithGuest, listMatchCandidates, type NewGuest, type NewParty } from './repo';
import { match, type GroupLabels } from './match';
import { nameKey } from './name-key';

export type EntryName = { firstName: string; lastName: string };

// A card the typed name may belong to. A single match needs no hint: the name says it all.
export type KnownCard = { guestId: string; hint: string | null };

export type EntryResult =
	{ kind: 'registered'; guestId: string } | { kind: 'known'; cards: KnownCard[] };

export function fullName({ firstName, lastName }: EntryName): string {
	return `${firstName} ${lastName}`;
}

// What a self-registered guest starts with (tech.md §6); the organizer adjusts it in the admin.
export function newRegistration(
	name: EntryName,
	botToken: string
): { party: NewParty; guest: NewGuest } {
	return {
		party: {
			title: fullName(name),
			audience: 'friends',
			plusOnePolicy: 'allowed',
			invitedToRegistry: false,
			note: null
		},
		guest: {
			firstName: name.firstName,
			lastName: name.lastName,
			displayName: name.firstName,
			nameKey: nameKey(fullName(name)),
			isPlusOne: false,
			botToken
		}
	};
}

export async function register(db: Db, name: EntryName): Promise<string> {
	const { party, guest } = newRegistration(name, randomBytes(32).toString('base64url'));
	return insertPartyWithGuest(db, party, guest);
}

async function knownCards(db: Db, name: EntryName, labels: GroupLabels): Promise<KnownCard[]> {
	const result = match(fullName(name), await listMatchCandidates(db), labels);
	if (result.kind === 'none') return [];
	if (result.kind === 'single') return [{ guestId: result.guestId, hint: null }];
	return result.candidates;
}

/**
 * Registers a name nobody has yet. A name that matches someone never registers silently: the
 * guest first sees the matching cards, so a return visit does not create a duplicate.
 */
export async function enter(db: Db, name: EntryName, labels: GroupLabels): Promise<EntryResult> {
	const cards = await knownCards(db, name, labels);
	if (cards.length > 0) return { kind: 'known', cards };
	return { kind: 'registered', guestId: await register(db, name) };
}

// The choice is re-derived from the name, so a posted id outside it never opens a card.
export async function chooseCard(
	db: Db,
	name: EntryName,
	guestId: string,
	labels: GroupLabels
): Promise<{ allowed: true } | { allowed: false; cards: KnownCard[] }> {
	const cards = await knownCards(db, name, labels);
	return cards.some((card) => card.guestId === guestId)
		? { allowed: true }
		: { allowed: false, cards };
}
