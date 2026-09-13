import type { Db } from '$lib/server/db';
import type { TelegramClient } from '$lib/server/telegram/client';
import { templates } from '$lib/server/telegram/templates';
import { demoPingJobSchema } from '$lib/types';
import { InvalidPayloadError } from '../errors';
import { withReceipt } from '../repo';

// Temporary skeleton topic, removed in task 5.3 (tech.md §5).
export const DEMO_PING = 'demo.ping';

export type DemoPingDeps = { db: Db; telegram: TelegramClient; adminChatId: number };

export async function handleDemoPing(
	deps: DemoPingDeps,
	data: unknown
): Promise<'sent' | 'duplicate'> {
	const parsed = demoPingJobSchema.safeParse(data);
	if (!parsed.success) {
		throw new InvalidPayloadError(
			DEMO_PING,
			parsed.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`)
		);
	}
	const { pingId } = parsed.data;

	const outcome = await withReceipt(deps.db, `${DEMO_PING}:${pingId}`, async () => {
		await deps.telegram.sendMessage({ chatId: deps.adminChatId, text: templates.demoPing(pingId) });
	});
	return outcome === 'done' ? 'sent' : 'duplicate';
}
