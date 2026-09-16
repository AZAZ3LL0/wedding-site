import { getConfig } from '$lib/server/config';
import type { TelegramClient } from './client';
import { FakeTelegramClient } from './fake';
import { RealTelegramClient } from './real';

// One instance per process, so /kitchen-sink/telegram shows what the worker sent.
let shared: TelegramClient | undefined;

export function getTelegramClient(): TelegramClient {
	if (!shared) {
		const { useFake, botToken } = getConfig().telegram;
		if (useFake) {
			shared = new FakeTelegramClient();
		} else {
			// config.ts already requires the token in this mode; failing here would mean a bad config.
			if (!botToken) throw new Error('USE_FAKE_TELEGRAM=false requires TELEGRAM_BOT_TOKEN');
			shared = new RealTelegramClient(botToken);
		}
	}
	return shared;
}
