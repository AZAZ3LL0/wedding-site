// The only place with site copy and event data. Validated by schema.ts when the server starts.
import type { Content } from './schema';

export const content = {
	couple: { bride: 'Алина', groom: 'TODO' },
	hosts: 'Семья Тулешовых',
	event: {
		title: 'Кыз Узату',
		date: '2026-11-28',
		time: '17:00',
		utcOffset: '+04:00', // Astrakhan
		rsvpDeadline: '2026-11-14', // TODO
		city: 'Астрахань'
	},
	envelope: {
		eyebrow: 'Приглашение на Кыз Узату',
		title: 'Алина',
		monogram: 'А',
		open: 'Открыть приглашение'
	},
	cover: {
		eyebrow: 'Кыз Узату',
		title: 'Алина',
		text: 'С огромной радостью приглашаем вас на наш особенный день',
		photo: { src: '/images/cover.svg', alt: 'TODO' }
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
		endTime: 'TODO',
		mapUrl:
			'https://yandex.ru/maps/?text=%D0%90%D1%81%D1%82%D1%80%D0%B0%D1%85%D0%B0%D0%BD%D1%8C%2C%20%D0%9A%D0%B0%D1%81%D0%BF%D0%B8%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0%2C%202%D0%91',
		photos: []
	},
	timeline: [],
	dressCode: {
		text: 'TODO',
		// TODO: replace the sample palette with the real one
		palette: [
			{ hex: '#6e6b3c', name: 'олива' },
			{ hex: '#7a1e2c', name: 'бордо' },
			{ hex: '#ebe4d4', name: 'молоко' },
			{ hex: '#4a3328', name: 'шоколад' }
		]
	},
	gifts: null,
	transfer: null,
	contacts: [],
	menu: {
		multiSelect: false,
		courses: [{ id: 'todo-course', label: 'TODO' }],
		drinks: [{ id: 'todo-drink', label: 'TODO' }]
	},
	music: { enabled: true, src: '/audio/TODO.mp3' },
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
		family: { greeting: 'TODO', address: 'ты', showRegistry: true },
		friends: { greeting: 'TODO', address: 'ты', showRegistry: false },
		colleagues: { greeting: 'TODO', address: 'вы', showRegistry: false }
	}
} satisfies Content;
