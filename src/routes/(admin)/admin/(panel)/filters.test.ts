import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AdminGuestRow } from '$lib/server/admin/repo';
import type { Audience } from '$lib/types';
import { EMPTY_FILTERS, actionUrl, filterRows, readFilters, type Filters } from './filters';

function row(over: Partial<AdminGuestRow>): AdminGuestRow {
	return {
		id: 'guest',
		firstName: 'Иван',
		lastName: 'Иванов',
		name: 'Иван Иванов',
		isPlusOne: false,
		invitedByName: null,
		companionName: null,
		partyId: 'party',
		partyTitle: 'Приглашение',
		audience: 'friends',
		plusOnePolicy: 'none',
		invitedToRegistry: false,
		telegramUsername: null,
		telegramLinked: false,
		rsvp: null,
		...over
	};
}

const answered = (attending: 'yes' | 'no'): AdminGuestRow['rsvp'] => ({
	attending,
	attendingRegistry: false,
	mainCourses: [],
	drinks: [],
	allergies: null,
	needsTransfer: false,
	comment: null,
	updatedAt: '2026-06-01T10:00:00.000Z'
});

const rows: AdminGuestRow[] = [
	row({ id: 'a', rsvp: answered('yes') }),
	row({
		id: 'b',
		firstName: 'Алёна',
		lastName: 'Петрова',
		name: 'Алёна Петрова',
		audience: 'family',
		rsvp: answered('no')
	}),
	row({
		id: 'c',
		firstName: 'Пётр',
		lastName: 'Козлов',
		name: 'Пётр Козлов',
		audience: 'colleagues'
	})
];

describe('readFilters', () => {
	it('falls back to "all" on values the panel does not offer', () => {
		const params = new URLSearchParams({ status: 'maybe', audience: 'vips', search: '  Иван  ' });
		expect(readFilters(params)).toEqual({ status: 'all', audience: 'all', search: 'Иван' });
	});

	it('reads an empty query as no filters', () => {
		expect(readFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
	});

	it('accepts only values the panel offers', () => {
		fc.assert(
			fc.property(fc.string(), fc.string(), (status, audience) => {
				const filters = readFilters(new URLSearchParams({ status, audience }));
				expect(['all', 'yes', 'no', 'none']).toContain(filters.status);
				expect(['all', 'family', 'friends', 'colleagues']).toContain(filters.audience);
			})
		);
	});
});

describe('filterRows', () => {
	it('keeps every guest with no filters', () => {
		expect(filterRows(rows, EMPTY_FILTERS)).toEqual(rows);
	});

	it('selects by answer', () => {
		const ids = (status: Filters['status']) =>
			filterRows(rows, { ...EMPTY_FILTERS, status }).map((r) => r.id);
		expect(ids('yes')).toEqual(['a']);
		expect(ids('no')).toEqual(['b']);
		expect(ids('none')).toEqual(['c']);
	});

	it('selects by group', () => {
		const ids = (audience: Audience) =>
			filterRows(rows, { ...EMPTY_FILTERS, audience }).map((r) => r.id);
		expect(ids('family')).toEqual(['b']);
		expect(ids('colleagues')).toEqual(['c']);
	});

	it('ignores case and ё in the search', () => {
		expect(filterRows(rows, { ...EMPTY_FILTERS, search: 'алена' }).map((r) => r.id)).toEqual(['b']);
		expect(filterRows(rows, { ...EMPTY_FILTERS, search: 'КОЗЛОВ' }).map((r) => r.id)).toEqual([
			'c'
		]);
	});

	it('returns a subset of the input in the input order', () => {
		fc.assert(
			fc.property(
				fc.constantFrom<Filters['status']>('all', 'yes', 'no', 'none'),
				fc.constantFrom<Filters['audience']>('all', 'family', 'friends', 'colleagues'),
				fc.string({ maxLength: 6 }),
				(status, audience, search) => {
					const result = filterRows(rows, { status, audience, search });
					expect(rows.filter((r) => result.includes(r))).toEqual(result);
				}
			)
		);
	});
});

describe('actionUrl', () => {
	it('posts to the bare action when nothing is filtered', () => {
		expect(actionUrl('deleteGuest', EMPTY_FILTERS)).toBe('?/deleteGuest');
	});

	it('carries the current filters so the post lands back on the same view', () => {
		expect(actionUrl('updateParty', { status: 'yes', audience: 'family', search: 'Иван' })).toBe(
			'?/updateParty&status=yes&audience=family&search=%D0%98%D0%B2%D0%B0%D0%BD'
		);
	});

	it('round-trips through readFilters', () => {
		fc.assert(
			fc.property(
				fc.constantFrom<Filters['status']>('all', 'yes', 'no', 'none'),
				fc.constantFrom<Filters['audience']>('all', 'family', 'friends', 'colleagues'),
				fc.string({ maxLength: 20 }).map((s) => s.trim()),
				(status, audience, search) => {
					const url = new URL(
						`http://localhost/admin${actionUrl('x', { status, audience, search })}`
					);
					expect(readFilters(url.searchParams)).toEqual({ status, audience, search });
				}
			)
		);
	});
});
