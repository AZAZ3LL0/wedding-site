import { timingSafeEqual } from 'node:crypto';

export const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/**
 * Compares the header Telegram sends with the configured secret. The webhook URL is public, so
 * this header is the only thing that separates Telegram from anyone else posting updates.
 */
export function secretMatches(expected: string | null, received: string | null): boolean {
	if (!expected || !received) return false;
	const a = Buffer.from(expected, 'utf8');
	const b = Buffer.from(received, 'utf8');
	// timingSafeEqual throws on different lengths, which would leak the secret length by itself.
	return a.length === b.length && timingSafeEqual(a, b);
}
