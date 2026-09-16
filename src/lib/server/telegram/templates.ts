import type { ContentData } from '$lib/content/schema';
import type { RsvpNotice } from '$lib/server/rsvp/repo';
import type { RsvpPublic } from '$lib/types';

type Menu = Pick<ContentData['menu'], 'courses' | 'drinks'>;

// The organizer sees an id the menu no longer has, so a stale choice is noticed and fixed.
function choices(ids: string[], options: { id: string; label: string }[]): string {
	if (ids.length === 0) return 'не выбрано';
	return ids.map((id) => options.find((option) => option.id === id)?.label ?? id).join(', ');
}

function rsvpNotice(
	kind: 'created' | 'updated',
	{ guest, answer, companion }: RsvpNotice,
	menu: Menu
) {
	const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ');
	const lines = [
		kind === 'created' ? 'Новый ответ на приглашение' : 'Гость изменил ответ',
		`${name} (${guest.partyTitle})`,
		`Придёт: ${answer.attending === 'yes' ? 'да' : 'нет'}`
	];
	if (answer.attending === 'yes') {
		if (answer.attendingRegistry) lines.push('ЗАГС: да');
		lines.push(`Горячее: ${choices(answer.mainCourses ?? [], menu.courses)}`);
		lines.push(`Напитки: ${choices(answer.drinks ?? [], menu.drinks)}`);
		if (answer.allergies) lines.push(`Аллергии: ${answer.allergies}`);
		if (answer.needsTransfer) lines.push('Трансфер: нужен');
	}
	if (answer.comment) lines.push(`Комментарий: ${answer.comment}`);
	if (guest.telegramUsername) lines.push(`Telegram: @${guest.telegramUsername}`);
	if (companion) {
		const companionName = [companion.firstName, companion.lastName].filter(Boolean).join(' ');
		lines.push(
			`Спутник: ${companionName}`,
			`Горячее спутника: ${choices(companion.mainCourses, menu.courses)}`,
			`Напитки спутника: ${choices(companion.drinks, menu.drinks)}`
		);
	}
	return lines.join('\n');
}

/**
 * Commands the guest can tap. Telegram turns any `/word` in a message body into a tappable
 * link, which is how the bot offers choices: `TelegramClient` carries a chat id and text and
 * nothing else, so an inline keyboard would mean sending outside the interface (tech.md §5).
 */
export const commands = {
	start: 'start',
	address: 'address',
	timing: 'timing',
	dressCode: 'dresscode',
	contacts: 'contacts',
	rsvp: 'rsvp',
	yes: 'yes',
	no: 'no'
} as const;

export const COURSE_PREFIX = 'course_';
export const DRINK_PREFIX = 'drink_';

// One-based, so the guest reads the first dish next to /course_1.
export const menuCommand = (prefix: string, index: number) => `/${prefix}${index + 1}`;

export type BotContent = Pick<
	ContentData,
	'venue' | 'registry' | 'timeline' | 'dressCode' | 'contacts' | 'menu' | 'rsvp'
>;

export type BotAnswer = { rsvp: Pick<RsvpPublic, 'attending' | 'mainCourses' | 'drinks'> | null };

// A placeholder never reaches a guest: the line is dropped instead of showing the word TODO.
function filled(value: string | null): string | null {
	return value === null || value === 'TODO' ? null : value;
}

function lines(...parts: (string | null | false)[]): string {
	return parts.filter((part) => typeof part === 'string').join('\n');
}

const help = lines(
	'Что я умею:',
	`/${commands.address} — где и когда`,
	`/${commands.timing} — тайминг дня`,
	`/${commands.dressCode} — дресс-код`,
	`/${commands.contacts} — к кому обратиться`,
	`/${commands.rsvp} — посмотреть и изменить ответ`
);

const linkNeeded =
	'Не узнаю этот чат. Откройте свою персональную ссылку на бота со страницы ответа на приглашение.';

function address({ venue, registry }: BotContent, registryVisible: boolean): string {
	return lines(
		venue.title,
		venue.address,
		filled(venue.startTime) && `Сбор гостей в ${venue.startTime}`,
		filled(venue.mapUrl),
		...(registryVisible && registry
			? [
					'',
					registry.title,
					registry.address,
					filled(registry.gatherTime) && `Сбор в ${registry.gatherTime}`,
					filled(registry.ceremonyTime) && `Церемония в ${registry.ceremonyTime}`,
					filled(registry.mapUrl)
				]
			: [])
	);
}

function timing({ timeline }: BotContent): string {
	if (timeline.length === 0) return 'Тайминг дня появится ближе к дате.';
	return lines(
		'Тайминг дня:',
		...timeline.map((item) =>
			lines(filled(item.time) ? `${item.time} — ${item.title}` : item.title, item.caption)
		)
	);
}

function dressCode({ dressCode: copy }: BotContent): string {
	const palette = copy.palette.map((color) => color.name).join(', ');
	return (
		lines(filled(copy.text), palette === '' ? null : `Цвета вечера: ${palette}`) ||
		'Дресс-код появится ближе к дате.'
	);
}

function contacts({ contacts: list }: BotContent): string {
	if (list.length === 0) return 'Контакты появятся ближе к дате.';
	return lines(
		'К кому обратиться:',
		...list.map((contact) =>
			[
				`${contact.role}: ${contact.name}`,
				filled(contact.phone),
				filled(contact.telegram) && `@${contact.telegram}`
			]
				.filter((part) => typeof part === 'string')
				.join(', ')
		)
	);
}

function menuList(
	options: { id: string; label: string }[],
	chosen: string[],
	prefix: string
): string[] {
	return options.map(
		(option, index) =>
			`${chosen.includes(option.id) ? '✓ ' : ''}${option.label} ${menuCommand(prefix, index)}`
	);
}

// What the guest sees on /rsvp and after every change (tech.md §13, 5.4).
function rsvpState({ rsvp }: BotAnswer, content: BotContent): string {
	const copy = content.rsvp;
	if (!rsvp) {
		return lines(
			'Вы ещё не ответили на приглашение.',
			`${copy.attendingYes} — /${commands.yes}`,
			`${copy.attendingNo} — /${commands.no}`
		);
	}
	if (rsvp.attending === 'no') {
		return lines(
			`${copy.attendingLabel}: ${copy.attendingNo}`,
			`Если планы изменились — /${commands.yes}`
		);
	}
	return lines(
		`${copy.attendingLabel}: ${copy.attendingYes}`,
		'',
		`${copy.coursesLabel}:`,
		...menuList(content.menu.courses, rsvp.mainCourses, COURSE_PREFIX),
		'',
		`${copy.drinksLabel}:`,
		...menuList(content.menu.drinks, rsvp.drinks, DRINK_PREFIX),
		'',
		`Передумали — /${commands.no}`
	);
}

// Every Telegram message text lives here.
export const templates = {
	demoPing: (pingId: string) => `Проверка очереди: демо-задача ${pingId} выполнена.`,
	rsvpNotice,
	bot: {
		help,
		linkNeeded,
		bound: (displayName: string) =>
			lines(`${displayName}, готово. Напоминания о свадьбе придут сюда.`, '', help),
		already: (displayName: string) =>
			lines(`${displayName}, вы уже подключены. Напоминания придут сюда.`, '', help),
		greeting: (displayName: string) => lines(`${displayName}, рады видеть.`, '', help),
		rejected:
			'Эта ссылка не подошла. Откройте свою персональную ссылку на странице ответа на приглашение.',
		address,
		timing,
		dressCode,
		contacts,
		rsvpState,
		answerFirst: (content: BotContent) =>
			lines(
				'Сначала ответьте, придёте ли вы.',
				`${content.rsvp.attendingYes} — /${commands.yes}`,
				`${content.rsvp.attendingNo} — /${commands.no}`
			),
		unknownChoice: (content: BotContent) => content.rsvp.unknownOption,
		saved: (state: string) => lines('Ответ сохранён.', '', state),
		rejectedAnswer: (content: BotContent) => content.rsvp.invalid,
		closed: (content: BotContent) => content.rsvp.closed
	}
};
