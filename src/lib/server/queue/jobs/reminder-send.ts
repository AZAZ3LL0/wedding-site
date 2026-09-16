import type { Db } from '$lib/server/db';
import { TelegramError, type TelegramClient } from '$lib/server/telegram/client';
import { claimReminder, findReminderTarget, markReminder } from '$lib/server/telegram/repo';
import { templates } from '$lib/server/telegram/templates';
import { reminderSendJobSchema } from '$lib/types';
import { InvalidPayloadError } from '../errors';

export const REMINDER_SEND = 'reminder.send';

export type ReminderSendDeps = { db: Db; telegram: TelegramClient };

export type SendOutcome = 'sent' | 'duplicate' | 'skipped';

export function reminderSendKey({ guestId, stage }: { guestId: string; stage: string }): string {
	return `${guestId}:${stage}`;
}

/**
 * Sends one reminder (tech.md §5). The `reminders` row is claimed before anything leaves the
 * process, so a duplicate job stops at the claim; a row left `failed` is claimed again, which
 * is what lets a retry reach the guest.
 */
export async function handleReminderSend(
	deps: ReminderSendDeps,
	data: unknown
): Promise<SendOutcome> {
	const parsed = reminderSendJobSchema.safeParse(data);
	if (!parsed.success) {
		throw new InvalidPayloadError(
			REMINDER_SEND,
			parsed.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`)
		);
	}
	const { guestId, stage } = parsed.data;

	if (!(await claimReminder(deps.db, guestId, stage))) return 'duplicate';

	const target = await findReminderTarget(deps.db, guestId);
	// Nobody to write to: a deleted guest, an unbound chat, or a companion the bot never messages.
	if (!target || target.chatId === null || target.isPlusOne) {
		await markReminder(deps.db, guestId, stage, 'skipped', null);
		return 'skipped';
	}

	try {
		await deps.telegram.sendMessage({
			chatId: target.chatId,
			text: templates.reminder(stage, target.displayName, target.attending)
		});
	} catch (error) {
		const message = error instanceof TelegramError ? error.message : String(error);
		await markReminder(deps.db, guestId, stage, 'failed', message);
		// The queue decides from the error kind whether this comes back: server and timeout retry,
		// rejected is cancelled by the worker.
		throw error;
	}
	return 'sent';
}
