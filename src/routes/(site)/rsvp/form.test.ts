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
		const values = valuesOf(answer, 'guest', {
			firstName: 'Ольга',
			lastName: 'Смирнова',
			mainCourses: ['fish'],
			drinks: []
		});
		const posted = formData([
			['attending', values.attending!],
			...(values.attendingRegistry ? [['attendingRegistry', 'yes'] as [string, string]] : []),
			...values.mainCourses.map((id): [string, string] => ['mainCourses', id]),
			...values.drinks.map((id): [string, string] => ['drinks', id]),
			['allergies', values.allergies],
			...(values.needsTransfer ? [['needsTransfer', 'yes'] as [string, string]] : []),
			['comment', values.comment],
			['telegramUsername', values.telegramUsername],
			['companion', 'yes'],
			['companionFirstName', values.companionFirstName],
			['companionLastName', values.companionLastName],
			...values.companionCourses.map((id): [string, string] => ['companionCourses', id])
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

describe('companion fields', () => {
	const posted = (attending: string, firstName: string) =>
		readForm(
			formData([
				['attending', attending],
				['companion', 'yes'],
				['companionFirstName', firstName],
				['companionLastName', ' Смирнова '],
				['companionCourses', 'fish'],
				['companionDrinks', 'tea']
			])
		);

	it('sends the companion with trimmed names when the toggle is on', () => {
		expect(toPayload(posted('yes', ' Ольга '))).toMatchObject({
			ok: true,
			payload: {
				companion: {
					firstName: 'Ольга',
					lastName: 'Смирнова',
					mainCourses: ['fish'],
					drinks: ['tea']
				}
			}
		});
	});

	it('asks for the companion name when the toggle is on and the name is blank', () => {
		expect(toPayload(posted('yes', '   '))).toEqual({ ok: false, error: 'companionNameRequired' });
	});

	it('ignores companion fields when the toggle is off', () => {
		const values = { ...posted('yes', 'Ольга'), companion: false };
		expect(toPayload(values)).toMatchObject({ ok: true, payload: { companion: null } });
	});

	it('drops a companion left checked by a guest who declines, since the block is hidden', () => {
		expect(toPayload(posted('no', 'Ольга'))).toMatchObject({
			ok: true,
			payload: { attending: 'no', companion: null }
		});
	});
});

describe('valuesOf', () => {
	it('starts an unanswered form empty', () => {
		expect(valuesOf(null, null, null)).toEqual({
			attending: null,
			attendingRegistry: false,
			mainCourses: [],
			drinks: [],
			allergies: '',
			needsTransfer: false,
			comment: '',
			telegramUsername: '',
			companion: false,
			companionFirstName: '',
			companionLastName: '',
			companionCourses: [],
			companionDrinks: []
		});
	});
});

describe('errorOf', () => {
	it('names a stale menu option and folds the rest into a generic message', () => {
		expect(errorOf('unknownOption')).toBe('unknownOption');
		expect(errorOf('companionNotAttending')).toBe('companionNotAttending');
		expect(errorOf('tooManyCourses')).toBe('invalid');
		expect(errorOf('companionNotAllowed')).toBe('invalid');
	});
});
