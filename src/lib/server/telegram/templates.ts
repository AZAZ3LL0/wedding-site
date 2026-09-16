import type { ContentData } from '$lib/content/schema';
import type { RsvpNotice } from '$lib/server/rsvp/repo';
import type { AttendStatus, ReminderStage, RsvpPublic } from '$lib/types';

// The site no longer asks about dishes and drinks, so the organizer's notice leaves them out too.
function rsvpNotice(kind: 'created' | 'updated', { guest, answer, companion }: RsvpNotice) {
	const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ');
	const lines = [
		kind === 'created' ? 'Новый ответ на приглашение' : 'Гость изменил ответ',
		`${name} (${guest.partyTitle})`,
		`Придёт: ${answer.attending === 'yes' ? 'да' : 'нет'}`
	];
	if (answer.attending === 'yes') {
		if (answer.attendingRegistry) lines.push('ЗАГС: да');
		if (answer.allergies) lines.push(`Аллергии: ${answer.allergies}`);
		if (answer.needsTransfer) lines.push('Трансфер: нужен');
	}
	if (answer.comment) lines.push(`Комментарий: ${answer.comment}`);
	if (guest.telegramUsername) lines.push(`Telegram: @${guest.telegramUsername}`);
	if (companion) {
		const companionName = [companion.firstName, companion.lastName].filter(Boolean).join(' ');
		lines.push(`Спутник: ${companionName}`);
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
	return lines(`${copy.attendingLabel}: ${copy.attendingYes}`, `Передумали — /${commands.no}`);
}

// One of three texts per stage, picked from the answer on file at send time (tech.md §5).
function reminder(stage: ReminderStage, displayName: string, attending: AttendStatus | null) {
	const head = `${displayName}, ${stage === 'd30' ? 'до свадьбы месяц' : 'до свадьбы неделя'}.`;
	if (attending === null) {
		return lines(head, 'Мы всё ещё ждём вашего ответа.', `Ответить — /${commands.rsvp}`);
	}
	if (attending === 'no') {
		return lines(
			head,
			'Вы ответили, что прийти не получится.',
			`Если планы изменились — /${commands.rsvp}`
		);
	}
	return lines(head, 'Ждём вас!', `Изменить ответ — /${commands.rsvp}`);
}

// Every Telegram message text lives here.
export const templates = {
	rsvpNotice,
	reminder,
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
		saved: (state: string) => lines('Ответ сохранён.', '', state),
		rejectedAnswer: (content: BotContent) => content.rsvp.invalid,
		closed: (content: BotContent) => content.rsvp.closed
	}
};
