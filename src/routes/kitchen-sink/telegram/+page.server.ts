import { getTelegramClient } from '$lib/server/telegram';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const client = getTelegramClient();
	const sent = client instanceof FakeTelegramClient ? client.sent : [];
	return {
		messages: sent.map((m) => ({ ...m, sentAt: m.sentAt.toISOString() })).reverse()
	};
};
