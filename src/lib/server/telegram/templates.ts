import type { ContentData } from '$lib/content/schema';
import type { RsvpNotice } from '$lib/server/rsvp/repo';

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

// Every Telegram message text lives here.
export const templates = {
	demoPing: (pingId: string) => `Проверка очереди: демо-задача ${pingId} выполнена.`,
	unknownRequest: (rawName: string, contact: string | null) =>
		`Гостя нет в списке: ${rawName}\nКонтакт: ${contact ?? 'не указан'}`,
	rsvpNotice
};
