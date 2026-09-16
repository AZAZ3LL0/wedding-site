import { and, eq, isNotNull } from 'drizzle-orm';
import type { Db } from '$lib/server/db';
import { guests, reminders, rsvps } from '$lib/server/db/schema';
import type { AttendStatus, ReminderStage } from '$lib/types';

export type BoundGuest = { guestId: string; displayName: string; chatId: number };

export type BindOutcome =
	| { kind: 'bound'; guest: BoundGuest }
	| { kind: 'already'; guest: BoundGuest }
	| { kind: 'rejected' };

/**
 * Attaches `chatId` to the guest that owns `token` (tech.md §5). The guest row is locked first,
 * so two taps on the same deep link bind once and the second tap reports the existing binding.
 *
 * Rejected: an unknown token, a companion token (a companion has no card of their own,
 * invariant 5), a guest already bound to another chat, and a chat already bound to another guest.
 */
export async function bindChat(
	db: Db,
	token: string,
	chatId: number,
	now: Date
): Promise<BindOutcome> {
	return db.transaction(async (tx) => {
		const [guest] = await tx
			.select({
				id: guests.id,
				displayName: guests.displayName,
				isPlusOne: guests.isPlusOne,
				telegramChatId: guests.telegramChatId
			})
			.from(guests)
			.where(eq(guests.botToken, token))
			.for('update');
		if (!guest || guest.isPlusOne) return { kind: 'rejected' };

		const bound = { guestId: guest.id, displayName: guest.displayName, chatId };
		if (guest.telegramChatId !== null) {
			return guest.telegramChatId === chatId
				? { kind: 'already', guest: bound }
				: { kind: 'rejected' };
		}

		// The chat id is unique: someone else holding it means two guests share one Telegram account.
		const [taken] = await tx
			.select({ id: guests.id })
			.from(guests)
			.where(eq(guests.telegramChatId, chatId));
		if (taken) return { kind: 'rejected' };

		await tx
			.update(guests)
			.set({ telegramChatId: chatId, botStartedAt: now })
			.where(eq(guests.id, guest.id));
		return { kind: 'bound', guest: bound };
	});
}

export async function findGuestByChat(db: Db, chatId: number): Promise<BoundGuest | null> {
	const [row] = await db
		.select({ guestId: guests.id, displayName: guests.displayName })
		.from(guests)
		.where(eq(guests.telegramChatId, chatId));
	return row ? { ...row, chatId } : null;
}

// Who a reminder run writes to: a bound guest who is not a companion (tech.md §5).
export async function listReminderTargets(db: Db): Promise<string[]> {
	const rows = await db
		.select({ id: guests.id })
		.from(guests)
		.where(and(isNotNull(guests.telegramChatId), eq(guests.isPlusOne, false)))
		.orderBy(guests.createdAt, guests.id);
	return rows.map((row) => row.id);
}

export type ReminderTarget = {
	chatId: number | null;
	isPlusOne: boolean;
	displayName: string;
	attending: AttendStatus | null;
};

export async function findReminderTarget(db: Db, guestId: string): Promise<ReminderTarget | null> {
	const [row] = await db
		.select({
			chatId: guests.telegramChatId,
			isPlusOne: guests.isPlusOne,
			displayName: guests.displayName,
			attending: rsvps.attending
		})
		.from(guests)
		.leftJoin(rsvps, eq(rsvps.guestId, guests.id))
		.where(eq(guests.id, guestId));
	return row ?? null;
}

/**
 * Claims the reminder before anything is sent (tech.md §5). A fresh row or a previously failed
 * one is claimed and returns true; an already sent or skipped one returns false, so a duplicate
 * run and a redelivered job both stop here instead of writing to the guest twice.
 */
export async function claimReminder(
	db: Db,
	guestId: string,
	stage: ReminderStage
): Promise<boolean> {
	const claimed = await db
		.insert(reminders)
		.values({ guestId, stage, status: 'sent' })
		.onConflictDoUpdate({
			target: [reminders.guestId, reminders.stage],
			set: { status: 'sent', error: null },
			setWhere: eq(reminders.status, 'failed')
		})
		.returning({ id: reminders.id });
	return claimed.length === 1;
}

export async function markReminder(
	db: Db,
	guestId: string,
	stage: ReminderStage,
	status: 'skipped' | 'failed',
	error: string | null
): Promise<void> {
	await db
		.update(reminders)
		.set({ status, error })
		.where(and(eq(reminders.guestId, guestId), eq(reminders.stage, stage)));
}

export type BotLinkRow = { botToken: string; telegramChatId: number | null };

// Read only for the guest's own /thanks page: the token is the one secret they may see (tech.md §11).
export async function findBotLinkRow(db: Db, guestId: string): Promise<BotLinkRow | null> {
	const [row] = await db
		.select({ botToken: guests.botToken, telegramChatId: guests.telegramChatId })
		.from(guests)
		.where(eq(guests.id, guestId));
	return row ?? null;
}
