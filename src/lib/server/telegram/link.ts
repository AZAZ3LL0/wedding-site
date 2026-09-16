// Telegram accepts a base64url payload of up to 64 characters after `?start=`.
const START_PAYLOAD = /^[A-Za-z0-9_-]{1,64}$/;
const USERNAME = /^[A-Za-z0-9_]{5,32}$/;

export type BotLinkInput = {
	botUsername: string | null;
	botToken: string;
	telegramChatId: number | null;
};

/**
 * The guest's personal deep link, or null when the link must not be shown (tech.md §13, 5.1):
 * no bot username configured, the guest already started the bot, or a token Telegram would
 * silently drop from the start payload.
 */
export function botLink({ botUsername, botToken, telegramChatId }: BotLinkInput): string | null {
	if (telegramChatId !== null) return null;
	const username = botUsername?.replace(/^@/, '') ?? '';
	if (!USERNAME.test(username) || !START_PAYLOAD.test(botToken)) return null;
	return `https://t.me/${username}?start=${botToken}`;
}
