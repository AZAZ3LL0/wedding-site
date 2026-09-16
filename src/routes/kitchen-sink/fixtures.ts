// Sample data for the dev-only showcase. Site copy lives in $lib/content, not here.
import type { PluralForms } from '$lib/types';

export const colorTokens = [
	'--c-ink',
	'--c-paper',
	'--c-ivory',
	'--c-muted',
	'--c-olive',
	'--c-olive-deep',
	'--c-wine'
] as const;

export const fontTokens = [
	{ token: '--font-display', className: 'font-display text-4xl' },
	{ token: '--font-script', className: 'font-script text-5xl' },
	{ token: '--font-body', className: 'font-body text-base' }
] as const;

export const specimen = 'Съешь же ещё этих мягких французских булок. Wedding 28.08';

function placeholder(color: string, label: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${color}"/><text x="200" y="160" font-size="28" text-anchor="middle" fill="#f7f7f5">${label}</text></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const forms = (one: string, few: string, many: string): PluralForms => [one, few, many];

export const sample = {
	heading: 'Алина и Самат',
	paragraph: 'Мы будем рады разделить этот день с вами.',
	countdown: {
		target: '2026-11-28T15:00:00+03:00',
		labels: {
			days: forms('день', 'дня', 'дней'),
			hours: forms('час', 'часа', 'часов'),
			minutes: forms('минута', 'минуты', 'минут'),
			seconds: forms('секунда', 'секунды', 'секунд')
		}
	},
	collage: [
		{ src: placeholder('#12352c', 'wide'), alt: 'Широкое фото', span: 2 as const },
		{ src: placeholder('#8a8a85', 'one'), alt: 'Фото один', span: 1 as const },
		{ src: placeholder('#1b1b1b', 'two'), alt: 'Фото два', span: 1 as const }
	],
	timeline: [
		{ time: '14:00', title: 'Сбор гостей', caption: 'ЗАГС, главный вход', icon: 'pin' as const },
		{ time: '15:00', title: 'Церемония', caption: 'Обмен кольцами', icon: 'rings' as const },
		{ time: '17:00', title: 'Банкет', caption: 'Ужин и танцы', icon: 'dish' as const }
	],
	map: {
		title: 'Ресторан у реки',
		address: 'Набережная, 1',
		mapUrl: 'https://yandex.ru/maps/',
		photos: [
			{ src: placeholder('#12352c', 'hall'), alt: 'Зал' },
			{ src: placeholder('#8a8a85', 'terrace'), alt: 'Терраса' }
		],
		linkLabel: 'Открыть на карте'
	},
	audio: {
		// 0.1 s of silence, so the toggle can really play without shipping a track.
		src: 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==',
		labels: { play: 'Включить музыку', pause: 'Выключить музыку' }
	},
	buttons: { solid: 'Отправить', ghost: 'Отмена', loading: 'Отправляем' },
	field: {
		label: 'Имя и фамилия',
		placeholder: 'Как в приглашении',
		error: 'Не нашли такого гостя',
		comment: 'Комментарий'
	},
	attendance: [
		{ id: 'yes', label: 'Приду' },
		{ id: 'no', label: 'Не смогу' }
	],
	drinks: {
		label: 'Напитки, не больше двух',
		options: [
			{ id: 'wine', label: 'Вино' },
			{ id: 'champagne', label: 'Шампанское' },
			{ id: 'juice', label: 'Сок' }
		]
	},
	toasts: { ok: 'Ответ сохранён', error: 'Не удалось сохранить ответ' },
	telegram: {
		title: 'Фейковый Telegram',
		empty: 'Сообщений пока нет'
	}
};
