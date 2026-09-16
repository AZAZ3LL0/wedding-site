/**
 * Admin copy. Local stub: tech.md has no `content.admin` block, so this file stays out of
 * `contentSchema` and out of `getContent()` until the spec adds one (CONTRACT GAP, stage 4).
 * Components still hold no strings, and the organizer-facing wording lives in one place.
 */
import type { Audience, AttendStatus, PlusOnePolicy } from '$lib/types';

export const admin = {
	title: 'Админка',
	nav: { guests: 'Гости', signOut: 'Выйти' },
	login: {
		title: 'Вход в админку',
		passwordLabel: 'Пароль',
		submit: 'Войти',
		failed: 'Неверный пароль',
		disabled: 'Пароль админки не задан. Задайте ADMIN_PASSWORD и перезапустите приложение'
	},
	stats: {
		title: 'Счётчики',
		total: 'Всего гостей',
		attending: 'Придут',
		declined: 'Не придут',
		noAnswer: 'Не ответили',
		registry: 'Будут в ЗАГСе',
		transfer: 'Нужен трансфер',
		courses: 'Горячее',
		drinks: 'Напитки',
		allergies: 'Аллергии и ограничения',
		noAllergies: 'Никто не указал'
	},
	filters: {
		title: 'Фильтры',
		search: 'Поиск по имени',
		searchPlaceholder: 'Имя или фамилия',
		status: 'Ответ',
		audience: 'Группа',
		all: 'Все',
		apply: 'Показать',
		reset: 'Сбросить',
		found: 'Показано гостей'
	},
	table: {
		name: 'Гость',
		party: 'Приглашение',
		audience: 'Группа',
		status: 'Ответ',
		companion: 'Спутник',
		telegram: 'Telegram',
		menu: 'Меню',
		notes: 'Аллергии и комментарий',
		settings: 'Настройки приглашения',
		empty: 'Гостей по таким фильтрам нет',
		none: 'нет',
		plusOne: 'спутник',
		invitedBy: 'от',
		telegramLinked: 'бот подключён',
		updatedAt: 'Изменён'
	},
	party: {
		plusOnePolicy: 'Спутник',
		invitedToRegistry: 'Зовём в ЗАГС',
		save: 'Сохранить',
		delete: 'Удалить гостя',
		deleteConfirm: 'Удалить гостя вместе с его ответом и спутником?',
		saved: 'Приглашение обновлено',
		deleted: 'Гость удалён',
		failed: 'Не получилось сохранить. Попробуйте ещё раз'
	},
	export: {
		link: 'Скачать xlsx',
		fileName: 'guests',
		guestsSheet: 'Гости',
		countsSheet: 'Счётчики',
		columns: {
			name: 'Гость',
			party: 'Приглашение',
			audience: 'Группа',
			status: 'Ответ',
			plusOne: 'Спутник',
			registry: 'ЗАГС',
			courses: 'Горячее',
			drinks: 'Напитки',
			allergies: 'Аллергии',
			transfer: 'Трансфер',
			comment: 'Комментарий',
			telegram: 'Telegram'
		},
		metric: 'Показатель',
		value: 'Значение',
		yes: 'да',
		no: 'нет'
	},
	audience: {
		family: 'Родные',
		friends: 'Друзья',
		colleagues: 'Коллеги'
	} satisfies Record<Audience, string>,
	plusOnePolicy: {
		none: 'Без спутника',
		allowed: 'Может привести спутника'
	} satisfies Record<PlusOnePolicy, string>,
	status: {
		yes: 'Придёт',
		no: 'Не придёт',
		none: 'Нет ответа'
	} satisfies Record<AttendStatus | 'none', string>
};

export type AdminCopy = typeof admin;
