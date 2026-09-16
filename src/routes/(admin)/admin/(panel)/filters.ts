// Filters live in the URL, so a filtered view survives a reload and can be shared as a link.
import type { AdminGuestRow } from '$lib/server/admin/repo';
import type { Audience } from '$lib/types';

export const STATUS_OPTIONS = ['all', 'yes', 'no', 'none'] as const;
export const AUDIENCE_OPTIONS = ['all', 'family', 'friends', 'colleagues'] as const;

export type StatusFilter = (typeof STATUS_OPTIONS)[number];
export type AudienceFilter = (typeof AUDIENCE_OPTIONS)[number];

export type Filters = {
	status: StatusFilter;
	audience: AudienceFilter;
	search: string;
};

export const EMPTY_FILTERS: Filters = { status: 'all', audience: 'all', search: '' };

function pick<T extends string>(options: readonly T[], value: string | null, fallback: T): T {
	return options.includes(value as T) ? (value as T) : fallback;
}

export function readFilters(params: URLSearchParams): Filters {
	return {
		status: pick(STATUS_OPTIONS, params.get('status'), 'all'),
		audience: pick(AUDIENCE_OPTIONS, params.get('audience'), 'all'),
		search: (params.get('search') ?? '').trim().slice(0, 60)
	};
}

// Search is forgiving the same way the name key is: case and ё never keep a guest out of results.
function normalize(value: string): string {
	return value.toLowerCase().replaceAll('ё', 'е');
}

function statusOf(row: AdminGuestRow): StatusFilter {
	return row.rsvp?.attending ?? 'none';
}

export function filterRows(rows: AdminGuestRow[], filters: Filters): AdminGuestRow[] {
	const search = normalize(filters.search);
	return rows.filter((row) => {
		if (filters.status !== 'all' && statusOf(row) !== filters.status) return false;
		if (filters.audience !== 'all' && row.audience !== (filters.audience as Audience)) return false;
		return search === '' || normalize(row.name).includes(search);
	});
}

export function filterQuery(filters: Filters): string {
	const params = new URLSearchParams();
	if (filters.status !== 'all') params.set('status', filters.status);
	if (filters.audience !== 'all') params.set('audience', filters.audience);
	if (filters.search !== '') params.set('search', filters.search);
	return params.toString();
}

// A form action rewrites the whole query string, so the current filters ride along with it and
// the table the organizer was looking at survives the post.
export function actionUrl(name: string, filters: Filters): string {
	const query = filterQuery(filters);
	return query ? `?/${name}&${query}` : `?/${name}`;
}
