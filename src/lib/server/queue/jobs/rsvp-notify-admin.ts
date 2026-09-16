import type { Db } from '$lib/server/db';
import { findRsvpNotice } from '$lib/server/rsvp/repo';
import type { TelegramClient } from '$lib/server/telegram/client';
import { templates } from '$lib/server/telegram/templates';
import { rsvpNotifyAdminJobSchema, type RsvpNotifyAdminJob } from '$lib/types';
import { InvalidPayloadError } from '../errors';
import { withReceipt } from '../repo';

export const RSVP_NOTIFY_ADMIN = 'rsvp.notify-admin';

export type RsvpNotifyAdminDeps = {
	db: Db;
	telegram: TelegramClient;
	adminChatId: number;
};

// One key per saved state of the answer, so each change reaches the organizer exactly once.
export function rsvpNotifyAdminKey({ guestId, kind, updatedAt }: RsvpNotifyAdminJob): string {
	return `${guestId}:${kind}:${updatedAt}`;
}

export async function handleRsvpNotifyAdmin(
	deps: RsvpNotifyAdminDeps,
	data: unknown
): Promise<'sent' | 'duplicate' | 'missing'> {
	const parsed = rsvpNotifyAdminJobSchema.safeParse(data);
	if (!parsed.success) {
		throw new InvalidPayloadError(
			RSVP_NOTIFY_ADMIN,
			parsed.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`)
		);
	}
	const job = parsed.data;

	// The guest or the answer is gone: nothing to report, and retrying will not bring it back.
	const notice = await findRsvpNotice(deps.db, job.guestId);
	if (!notice) return 'missing';

	const key = `${RSVP_NOTIFY_ADMIN}:${rsvpNotifyAdminKey(job)}`;
	const outcome = await withReceipt(deps.db, key, async () => {
		await deps.telegram.sendMessage({
			chatId: deps.adminChatId,
			text: templates.rsvpNotice(job.kind, notice)
		});
	});
	return outcome === 'done' ? 'sent' : 'duplicate';
}
