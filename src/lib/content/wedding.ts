// The only place with site copy and event data. Validated by schema.ts when the server starts.
import type { Content } from './schema';

export const content = {
	couple: { bride: 'Алина', groom: 'Самат' },
	hosts: 'Семья Тулешовых',
	event: {
		title: 'Кыз Узату',
		date: '2026-11-28',
		time: '17:00',
		utcOffset: '+04:00', // Astrakhan
		rsvpDeadline: '2026-11-14',
		city: 'Астрахань'
	},
	envelope: {
		eyebrow: 'Приглашение на',
		title: 'Алина Кыз Узату',
		monogram: 'Т',
		open: 'Нажмите на печать'
	},
	// The card inside the envelope, after the printed invitation: title, text, date, place, hosts.
	cover: {
		eyebrow: 'Кыз Узату!',
		title: 'Алина',
		text: 'С огромной радостью приглашаем вас на наш особенный день и разделить с нами эту трогательную и важную дату.',
		// The card no longer frames a photo; this one is the link preview in messengers.
		photo: { src: '/images/og.jpg', alt: 'Бордовый конверт с сургучной печатью' }
	},
	invitation: {
		eyebrow: 'Ждём вас в',
		title: 'Астрахани',
		dateLine: 'в субботу, 28 ноября 2026',
		timeLine: 'начало в 17:00',
		text: 'С огромной радостью приглашаем вас на наш особенный день и разделить с нами эту трогательную и важную дату.'
	},
	registry: null,
	venue: {
		title: 'Банкетный зал «Европейский»',
		address: 'г. Астрахань, Каспийская улица, 2Б',
		startTime: '17:00',
		endTime: '00:00',
		// The venue's own card: a search by the address text lands on a different Каспийская, 4А.
		mapUrl: 'https://2gis.ru/astrakhan/firm/70000001047661941',
		photos: []
	},
	timeline: [],
	dressCode: {
		text: 'Следовать дресс-коду не обязательно: мы в любом случае будем рады вас видеть',
		// Olive Green, Sage Green, Butter Yellow, Burnt Rose, Rich Mahogany.
		palette: [
			{ hex: '#68662c', name: 'оливковый' },
			{ hex: '#b5b4a0', name: 'шалфей' },
			{ hex: '#f6edc9', name: 'сливочный' },
			{ hex: '#8f3a4a', name: 'пыльная роза' },
			{ hex: '#3c0606', name: 'махагон' }
		]
	},
	gifts: null,
	transfer: null,
	contacts: [],
	// The venue sets one menu for everyone, so the form does not ask about dishes and drinks.
	menu: {
		multiSelect: false,
		courses: [],
		drinks: []
	},
	// Off until the track arrives: drop it at static/audio/music.mp3 and switch this on.
	music: { enabled: false, src: '/audio/music.mp3' },
	sections: {
		location: {
			eyebrow: 'Место',
			title: 'Где праздник',
			venueStart: 'Сбор гостей в',
			registryGather: 'Сбор в',
			registryCeremony: 'Церемония в'
		},
		dressCode: { eyebrow: 'Дресс-код', title: 'Цвета вечера' },
		farewell: { eyebrow: 'С любовью' }
	},
	entry: {
		eyebrow: 'Приглашение на Кыз Узату',
		title: 'Представьтесь, пожалуйста',
		text: 'Введите имя и фамилию, чтобы открыть приглашение',
		firstNameLabel: 'Имя',
		lastNameLabel: 'Фамилия',
		submit: 'Открыть приглашение',
		firstNameRequired: 'Введите имя',
		lastNameRequired: 'Введите фамилию',
		knownTitle: 'Вы уже открывали приглашение?',
		knownText: 'Нашли похожее имя. Выберите себя, чтобы вернуться к своему ответу',
		knownNew: 'Это не я, открыть новое приглашение',
		failed: 'Не получилось открыть приглашение. Попробуйте ещё раз'
	},
	rsvp: {
		cta: 'Заполнить анкету гостя',
		ctaAnswered: 'Посмотреть ответ',
		eyebrow: 'Ответ на приглашение',
		title: 'Будете с нами?',
		deadline: 'Просим ответить до 14 ноября',
		attendingLabel: 'Ваш ответ',
		attendingYes: 'С радостью приду',
		attendingNo: 'К сожалению, не смогу',
		registryLabel: 'ЗАГС',
		registryOption: 'Буду на церемонии в ЗАГСе',
		coursesLabel: 'Горячее',
		drinksLabel: 'Напитки',
		allergiesLabel: 'Аллергии и ограничения в еде',
		allergiesPlaceholder: 'Например, не ем орехи',
		transferLabel: 'Трансфер',
		transferOption: 'Нужен трансфер',
		companionLabel: 'Спутник',
		companionOption: 'Приду со спутником',
		companionFirstName: 'Имя спутника',
		companionLastName: 'Фамилия спутника',
		companionCourses: 'Горячее для спутника',
		companionDrinks: 'Напитки для спутника',
		commentLabel: 'Комментарий',
		commentPlaceholder: 'Всё, что нам стоит знать',
		telegramLabel: 'Telegram',
		telegramPlaceholder: '@username',
		telegramHint: 'Чтобы мы могли связаться с вами',
		submit: 'Отправить ответ',
		save: 'Сохранить ответ',
		attendingRequired: 'Выберите, придёте ли вы',
		companionNameRequired: 'Укажите имя спутника',
		companionNotAttending: 'Спутника можно добавить, только если вы придёте',
		unknownOption: 'Этого варианта уже нет в меню, выберите заново',
		invalid: 'Проверьте ответ и отправьте ещё раз',
		failed: 'Не получилось сохранить ответ. Попробуйте ещё раз',
		closed: 'Приём ответов завершён. Если планы изменились, свяжитесь с нами'
	},
	thanks: {
		eyebrow: 'Ответ получен',
		titleYes: 'Спасибо, ждём вас!',
		titleNo: 'Спасибо, что ответили',
		summaryTitle: 'Ваш ответ',
		companionTitle: 'Спутник',
		empty: 'не указано',
		edit: 'Изменить ответ',
		back: 'Вернуться к приглашению',
		bot: {
			title: 'Напоминание в Telegram',
			text: 'Подключите бота, и мы напомним о свадьбе за месяц и за неделю',
			cta: 'Подключить бота'
		}
	},
	ui: {
		countdown: {
			days: ['день', 'дня', 'дней'],
			hours: ['час', 'часа', 'часов'],
			minutes: ['минута', 'минуты', 'минут'],
			seconds: ['секунда', 'секунды', 'секунд']
		},
		audio: { play: 'Включить музыку', pause: 'Выключить музыку' },
		map: { open: 'Открыть на карте' }
	},
	byAudience: {
		family: { label: 'родные', greeting: 'Ждём тебя,', address: 'ты', showRegistry: true },
		friends: { label: 'друзья', greeting: 'Ждём тебя,', address: 'ты', showRegistry: false },
		colleagues: { label: 'коллеги', greeting: 'Ждём вас,', address: 'вы', showRegistry: false }
	}
} satisfies Content;
