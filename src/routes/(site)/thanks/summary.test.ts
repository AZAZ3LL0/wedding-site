import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContent } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import type { RsvpPublic } from '$lib/types';
import { answerRows, companionSummary } from './summary';

const content = parseContent(raw);
const { rsvp: copy } = content;

const yes: RsvpPublic = {
	attending: 'yes',
	attendingRegistry: true,
	mainCourses: [],
	drinks: [],
	allergies: 'орехи',
	needsTransfer: true,
	songRequest: null,
	comment: 'Приеду к семи',
	updatedAt: '2026-10-01T10:00:00.000Z'
};

describe('answerRows', () => {
	it('lists a full yes answer', () => {
		expect(answerRows(yes, 'maria', content)).toEqual([
			{ label: copy.attendingLabel, value: copy.attendingYes },
			{ label: copy.registryLabel, value: copy.registryOption },
			{ label: copy.allergiesLabel, value: 'орехи' },
			{ label: copy.transferLabel, value: copy.transferOption },
			{ label: copy.commentLabel, value: 'Приеду к семи' },
			{ label: copy.telegramLabel, value: '@maria' }
		]);
	});

	it('shows only the answer, comment and username for a no', () => {
		const no = { ...yes, attending: 'no' as const };
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
		expect(answerRows(plain, null, content).map((r) => r.label)).toEqual([copy.attendingLabel]);
	});

	// The form no longer asks about dishes and drinks, so the summary never mentions them.
	it('never shows a menu row, whatever an older answer stored', () => {
		const ids = fc.array(fc.stringMatching(/^[a-z0-9-]{1,10}$/), { maxLength: 5 });
		fc.assert(
			fc.property(ids, ids, (mainCourses, drinks) => {
				const labels = answerRows({ ...yes, mainCourses, drinks }, 'maria', content).map(
					(r) => r.label
				);
				expect(labels).not.toContain(copy.coursesLabel);
				expect(labels).not.toContain(copy.drinksLabel);
			})
		);
	});
});

describe('companionSummary', () => {
	it('names the companion and lists no menu', () => {
		expect(
			companionSummary({
				firstName: 'Ольга',
				lastName: 'Смирнова',
				mainCourses: ['plov'],
				drinks: ['tea']
			})
		).toEqual({ name: 'Ольга Смирнова', rows: [] });
	});

	it('uses the first name alone without a last name', () => {
		expect(
			companionSummary({ firstName: 'Оля', lastName: '', mainCourses: [], drinks: [] }).name
		).toBe('Оля');
	});
});
