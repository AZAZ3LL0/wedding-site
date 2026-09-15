import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RsvpPublic } from '$lib/types';
import { errorOf, readForm, toPayload, valuesOf } from './form';

function formData(entries: [string, string][]) {
	const data = new FormData();
	for (const [name, value] of entries) data.append(name, value);
	return data;
}

const answer: RsvpPublic = {
	attending: 'yes',
	attendingRegistry: true,
	mainCourses: ['plov'],
	drinks: ['tea', 'juice'],
	allergies: 'орехи',
	needsTransfer: true,
	songRequest: null,
	comment: 'Приеду к семи',
	updatedAt: '2026-10-01T10:00:00.000Z'
};

describe('readForm and toPayload', () => {
	it('turns a posted form into the shared payload', () => {
		const values = readForm(
			formData([
				['attending', 'yes'],
				['attendingRegistry', 'yes'],
				['mainCourses', 'plov'],
				['drinks', 'tea'],
				['drinks', 'juice'],
				['allergies', 'орехи'],
				['comment', ''],
				['telegramUsername', '@guest']
			])
		);

		expect(toPayload(values)).toEqual({
			ok: true,
			payload: {
				attending: 'yes',
				attendingRegistry: true,
				mainCourses: ['plov'],
				drinks: ['tea', 'juice'],
				allergies: 'орехи',
				needsTransfer: false,
				songRequest: null,
				comment: null,
				telegramUsername: '@guest',
				companion: null
			}
		});
	});

	it('asks for an answer when neither option is chosen or the value is forged', () => {
		expect(toPayload(readForm(formData([])))).toEqual({ ok: false, error: 'attendingRequired' });
		expect(toPayload(readForm(formData([['attending', 'maybe']])))).toEqual({
			ok: false,
			error: 'attendingRequired'
		});
	});

	it('rejects text over the schema limits', () => {
		const values = readForm(
			formData([
				['attending', 'yes'],
				['allergies', 'x'.repeat(301)]
			])
		);
		expect(toPayload(values)).toEqual({ ok: false, error: 'invalid' });
	});

	it('round-trips a saved answer through the form unchanged', () => {
		const values = valuesOf(answer, 'guest');
		const posted = formData([
			['attending', values.attending!],
			...(values.attendingRegistry ? [['attendingRegistry', 'yes'] as [string, string]] : []),
			...values.mainCourses.map((id): [string, string] => ['mainCourses', id]),
			...values.drinks.map((id): [string, string] => ['drinks', id]),
			['allergies', values.allergies],
			...(values.needsTransfer ? [['needsTransfer', 'yes'] as [string, string]] : []),
			['comment', values.comment],
			['telegramUsername', values.telegramUsername]
		]);
		expect(readForm(posted)).toEqual(values);
		expect(values.telegramUsername).toBe('@guest');
	});

	it('never throws on arbitrary posted fields', () => {
		fc.assert(
			fc.property(fc.array(fc.tuple(fc.string(), fc.string())), (entries) => {
				const result = toPayload(readForm(formData(entries)));
				expect(typeof result.ok).toBe('boolean');
			})
		);
	});
});

describe('valuesOf', () => {
	it('starts an unanswered form empty', () => {
		expect(valuesOf(null, null)).toEqual({
			attending: null,
			attendingRegistry: false,
			mainCourses: [],
			drinks: [],
			allergies: '',
			needsTransfer: false,
			comment: '',
			telegramUsername: ''
		});
	});
});

describe('errorOf', () => {
	it('names a stale menu option and folds the rest into a generic message', () => {
		expect(errorOf('unknownOption')).toBe('unknownOption');
		expect(errorOf('tooManyCourses')).toBe('invalid');
		expect(errorOf('companionNotAllowed')).toBe('invalid');
	});
});
