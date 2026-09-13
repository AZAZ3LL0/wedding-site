import { getAppQueue } from '$lib/server/queue/boss';
import { getTelegramClient } from '$lib/server/telegram';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const client = getTelegramClient();
	const sent = client instanceof FakeTelegramClient ? client.sent : [];
	return {
		messages: sent.map((m) => ({ ...m, sentAt: m.sentAt.toISOString() })).reverse()
	};
};

export const actions: Actions = {
	ping: async () => {
		const queue = await getAppQueue();
		await queue.sendDemoPing();
		return { queued: true };
	}
};
