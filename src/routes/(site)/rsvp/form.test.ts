import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RsvpPublic } from '$lib/types';
import { errorOf, readForm, toSubmission, valuesOf } from './form';

function formData(entries: [string, string][]) {
	const data = new FormData();
	for (const [name, value] of entries) data.append(name, value);
	return data;
}

const answer: RsvpPublic = {
	attending: 'yes',
	attendingRegistry: false,
	mainCourses: [],
	drinks: [],
	allergies: null,
	needsTransfer: false,
	songRequest: null,
	comment: null,
	updatedAt: '2026-10-01T10:00:00.000Z'
};

describe('readForm and toSubmission', () => {
	it('turns a posted form into the shared payload and the guest name', () => {
		const values = readForm(
			formData([
				['name', '  Иван   Петров '],
				['attending', 'yes']
			])
		);

		expect(toSubmission(values)).toEqual({
			ok: true,
			submission: {
				name: { firstName: 'Иван', lastName: 'Петров' },
				payload: {
					attending: 'yes',
					attendingRegistry: false,
					mainCourses: [],
					drinks: [],
					allergies: null,
					needsTransfer: false,
					songRequest: null,
					comment: null,
					telegramUsername: null,
					companion: null
				}
			}
		});
	});

	it('carries the companion as a first and last name', () => {
		const values = readForm(
			formData([
				['name', 'Иван Петров'],
				['attending', 'yes'],
				['companion', 'yes'],
				['companionName', 'Ольга Петрова']
			])
		);
		const parsed = toSubmission(values);

		expect(parsed).toMatchObject({
			ok: true,
			submission: {
				payload: {
					companion: { firstName: 'Ольга', lastName: 'Петрова', mainCourses: [], drinks: [] }
				}
			}
		});
	});

	it('drops a companion left checked by someone who declines', () => {
		const values = readForm(
			formData([
				['name', 'Иван Петров'],
				['attending', 'no'],
				['companion', 'yes'],
				['companionName', 'Ольга']
			])
		);

		expect(toSubmission(values)).toMatchObject({
			ok: true,
			submission: { payload: { companion: null } }
		});
	});

	it.each<[string, [string, string][]]>([
		['a missing name', [['attending', 'yes']]],
		[
			'a blank name',
			[
				['name', '   '],
				['attending', 'yes']
			]
		]
	])('refuses %s', (_, entries) => {
		expect(toSubmission(readForm(formData(entries)))).toEqual({ ok: false, error: 'nameRequired' });
	});

	it('refuses a form without an answer', () => {
		expect(toSubmission(readForm(formData([['name', 'Иван Петров']])))).toEqual({
			ok: false,
			error: 'attendingRequired'
		});
	});

	it('refuses a companion without a name', () => {
		const entries: [string, string][] = [
			['name', 'Иван Петров'],
			['attending', 'yes'],
			['companion', 'yes'],
			['companionName', '  ']
		];
		expect(toSubmission(readForm(formData(entries)))).toEqual({
			ok: false,
			error: 'companionNameRequired'
		});
	});

	it('accepts whatever the form can post', () => {
		fc.assert(
			fc.property(
				fc.record({
					name: fc.string({ maxLength: 40 }),
					attending: fc.constantFrom('yes', 'no', '', 'maybe'),
					companion: fc.boolean(),
					companionName: fc.string({ maxLength: 40 })
				}),
				({ name, attending, companion, companionName }) => {
					const entries: [string, string][] = [
						['name', name],
						['attending', attending],
						['companionName', companionName]
					];
					if (companion) entries.push(['companion', 'yes']);
					const parsed = toSubmission(readForm(formData(entries)));
					// Either a payload the service accepts, or a message the page can show.
					expect(
						parsed.ok ? typeof parsed.submission.payload.attending : parsed.error
					).toBeTruthy();
				}
			)
		);
	});
});

describe('valuesOf', () => {
	it('fills the form from the stored name, answer and companion', () => {
		expect(
			valuesOf({ firstName: 'Иван', lastName: 'Петров' }, answer, {
				firstName: 'Ольга',
				lastName: 'Петрова',
				mainCourses: [],
				drinks: []
			})
		).toEqual({
			name: 'Иван Петров',
			attending: 'yes',
			companion: true,
			companionName: 'Ольга Петрова'
		});
	});

	it('leaves the form empty for a guest who has not answered', () => {
		expect(valuesOf(null, null, null)).toEqual({
			name: '',
			attending: null,
			companion: false,
			companionName: ''
		});
	});
});

describe('errorOf', () => {
	it('keeps the rejection the page has a message for and hides the rest', () => {
		expect(errorOf('companionNotAttending')).toBe('companionNotAttending');
		expect(errorOf('unknownOption')).toBe('invalid');
	});
});
