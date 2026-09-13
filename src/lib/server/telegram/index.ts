import { getConfig } from '$lib/server/config';
import type { TelegramClient } from './client';
import { FakeTelegramClient } from './fake';

// One instance per process, so /kitchen-sink/telegram shows what the worker sent.
let shared: TelegramClient | undefined;

export function getTelegramClient(): TelegramClient {
	if (!shared) {
		if (!getConfig().telegram.useFake) {
			// The grammY client lands in task 5.1. Failing at startup beats silently dropping messages.
			throw new Error('USE_FAKE_TELEGRAM=false requires the real Telegram client from task 5.1');
		}
		shared = new FakeTelegramClient();
	}
	return shared;
}
