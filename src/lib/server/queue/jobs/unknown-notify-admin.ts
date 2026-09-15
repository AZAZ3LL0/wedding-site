import type { Db } from '$lib/server/db';
import { findUnknownRequest } from '$lib/server/guests/repo';
import type { TelegramClient } from '$lib/server/telegram/client';
import { templates } from '$lib/server/telegram/templates';
import { unknownNotifyAdminJobSchema } from '$lib/types';
import { InvalidPayloadError } from '../errors';
import { withReceipt } from '../repo';

export const UNKNOWN_NOTIFY_ADMIN = 'unknown.notify-admin';

export type UnknownNotifyAdminDeps = { db: Db; telegram: TelegramClient; adminChatId: number };

export async function handleUnknownNotifyAdmin(
	deps: UnknownNotifyAdminDeps,
	data: unknown
): Promise<'sent' | 'duplicate' | 'missing'> {
	const parsed = unknownNotifyAdminJobSchema.safeParse(data);
	if (!parsed.success) {
		throw new InvalidPayloadError(
			UNKNOWN_NOTIFY_ADMIN,
			parsed.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`)
		);
	}
	const { requestId } = parsed.data;

	// Deleted after queueing: nothing left to report, and retrying will not bring it back.
	const request = await findUnknownRequest(deps.db, requestId);
	if (!request) return 'missing';

	const outcome = await withReceipt(deps.db, `${UNKNOWN_NOTIFY_ADMIN}:${requestId}`, async () => {
		await deps.telegram.sendMessage({
			chatId: deps.adminChatId,
			text: templates.unknownRequest(request.rawName, request.contact)
		});
	});
	return outcome === 'done' ? 'sent' : 'duplicate';
}
