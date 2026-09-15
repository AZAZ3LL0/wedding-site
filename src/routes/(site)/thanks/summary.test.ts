import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContent } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import type { RsvpPublic } from '$lib/types';
import { answerRows, companionSummary } from './summary';

const base = parseContent(raw);
const content = {
	...base,
	menu: {
		multiSelect: true,
		courses: [
			{ id: 'plov', label: 'Плов' },
			{ id: 'fish', label: 'Судак' }
		],
		drinks: [
			{ id: 'tea', label: 'Чай' },
			{ id: 'juice', label: 'Сок' }
		]
	}
};
const { rsvp: copy, thanks } = content;

const yes: RsvpPublic = {
	attending: 'yes',
	attendingRegistry: true,
	mainCourses: ['fish', 'plov'],
	drinks: [],
	allergies: 'орехи',
	needsTransfer: true,
	songRequest: null,
	comment: 'Приеду к семи',
	updatedAt: '2026-10-01T10:00:00.000Z'
};

describe('answerRows', () => {
	it('lists a full yes answer with menu labels in the chosen order', () => {
		expect(answerRows(yes, 'maria', content)).toEqual([
			{ label: copy.attendingLabel, value: copy.attendingYes },
			{ label: copy.registryLabel, value: copy.registryOption },
			{ label: copy.coursesLabel, value: 'Судак, Плов' },
			{ label: copy.drinksLabel, value: thanks.empty },
			{ label: copy.allergiesLabel, value: 'орехи' },
			{ label: copy.transferLabel, value: copy.transferOption },
			{ label: copy.commentLabel, value: 'Приеду к семи' },
			{ label: copy.telegramLabel, value: '@maria' }
		]);
	});

	it('shows only the answer, comment and username for a no', () => {
		const no = { ...yes, attending: 'no' as const, telegramUsername: null };
		expect(answerRows(no, null, content)).toEqual([
			{ label: copy.attendingLabel, value: copy.attendingNo },
			{ label: copy.commentLabel, value: 'Приеду к семи' }
		]);
	});

	it('leaves out registry, allergies, transfer and comment when not given', () => {
		const plain = {
			...yes,
			attendingRegistry: false,
			allergies: null,
			needsTransfer: false,
			comment: null
		};
		expect(answerRows(plain, null, content).map((r) => r.label)).toEqual([
			copy.attendingLabel,
			copy.coursesLabel,
			copy.drinksLabel
		]);
	});

	it('never shows a menu id the content does not have', () => {
		const ids = fc.array(fc.stringMatching(/^[a-z0-9-]{1,10}$/), { maxLength: 5 });
		fc.assert(
			fc.property(ids, ids, (mainCourses, drinks) => {
				const rows = answerRows({ ...yes, mainCourses, drinks }, null, content);
				const known = new Set([
					...content.menu.courses.map((o) => o.label),
					...content.menu.drinks.map((o) => o.label),
					thanks.empty
				]);
				for (const row of rows.filter(
					(r) => r.label === copy.coursesLabel || r.label === copy.drinksLabel
				)) {
					for (const part of row.value.split(', ')) expect(known).toContain(part);
				}
			})
		);
	});
});

describe('companionSummary', () => {
	it('names the companion and lists their menu', () => {
		expect(
			companionSummary(
				{
					firstName: 'Ольга',
					lastName: 'Смирнова',
					mainCourses: ['plov'],
					drinks: ['tea', 'juice']
				},
				content
			)
		).toEqual({
			name: 'Ольга Смирнова',
			rows: [
				{ label: copy.coursesLabel, value: 'Плов' },
				{ label: copy.drinksLabel, value: 'Чай, Сок' }
			]
		});
	});

	it('uses the first name alone without a last name', () => {
		const summary = companionSummary(
			{ firstName: 'Оля', lastName: '', mainCourses: [], drinks: [] },
			content
		);
		expect(summary.name).toBe('Оля');
		expect(summary.rows.map((r) => r.value)).toEqual([thanks.empty, thanks.empty]);
	});
});
