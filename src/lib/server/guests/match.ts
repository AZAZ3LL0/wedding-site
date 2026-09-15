import type { Audience, MatchResult } from '$lib/types';
import { nameKey } from './name-key';

// Every guest from the list, companions included (tech.md §4, invariant 5).
export type MatchCandidate = {
	guestId: string;
	nameKey: string;
	lastName: string;
	audience: Audience;
	// Set only for a companion: their name opens the inviter's card.
	invitedByGuestId: string | null;
};

// Guest-facing names of the audiences, used to tell namesakes apart.
export type GroupLabels = Record<Audience, string>;

const MAX_TOKEN_DISTANCE = 2;

// Counts code points, so a letter outside the BMP is one edit, not two.
export function levenshtein(a: string, b: string): number {
	const s = Array.from(a);
	const t = Array.from(b);
	let previous = Array.from({ length: t.length + 1 }, (_, j) => j);
	for (let i = 1; i <= s.length; i++) {
		const current = [i];
		for (let j = 1; j <= t.length; j++) {
			const substitution = previous[j - 1]! + (s[i - 1] === t[j - 1] ? 0 : 1);
			current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution);
		}
		previous = current;
	}
	return previous[t.length]!;
}

// Pairs every query token with a distinct close token. A typo can reorder sorted tokens, so
// position alone is not enough. Equal counts keep the search to a guest's two or three tokens.
function tokensClose(query: string[], target: string[]): boolean {
	if (query.length !== target.length) return false;
	const used = new Array<boolean>(target.length).fill(false);
	const assign = (i: number): boolean => {
		if (i === query.length) return true;
		for (let j = 0; j < target.length; j++) {
			if (used[j] || levenshtein(query[i]!, target[j]!) > MAX_TOKEN_DISTANCE) continue;
			used[j] = true;
			if (assign(i + 1)) return true;
			used[j] = false;
		}
		return false;
	};
	return assign(0);
}

function initial(lastName: string): string {
	const first = Array.from(lastName.trim())[0];
	return first ? `${first.toUpperCase()}.` : '';
}

// The last name initial when it tells everyone apart, otherwise the group.
function hints(hits: MatchCandidate[], groupLabels: GroupLabels): string[] {
	const initials = hits.map((hit) => initial(hit.lastName));
	if (!initials.includes('') && new Set(initials).size === hits.length) return initials;
	return hits.map((hit) => groupLabels[hit.audience]);
}

/**
 * Finds whose invitation a typed name opens, see tech.md §6. Exact key matches win; only when
 * there are none does a name with a typo of up to two edits per token count.
 */
export function match(
	name: string,
	candidates: MatchCandidate[],
	groupLabels: GroupLabels
): MatchResult {
	// nameKey is idempotent, so both a raw name and a stored key work here.
	const key = nameKey(name);
	if (key === '') return { kind: 'none' };

	const exact = candidates.filter((c) => c.nameKey === key);
	const tokens = key.split(' ');
	const found =
		exact.length > 0
			? exact
			: candidates.filter((c) => c.nameKey !== '' && tokensClose(tokens, c.nameKey.split(' ')));

	const byId = new Map(candidates.map((c) => [c.guestId, c]));
	// One entry per card: a guest and their companion both matching still open one invitation.
	const cards = new Map<string, MatchCandidate>();
	for (const hit of found) {
		const ownerId = hit.invitedByGuestId ?? hit.guestId;
		// A companion whose inviter is gone has no card to open.
		if (!byId.has(ownerId) || cards.has(ownerId)) continue;
		cards.set(ownerId, hit);
	}

	if (cards.size === 0) return { kind: 'none' };
	const ids = [...cards.keys()];
	if (ids.length === 1) return { kind: 'single', guestId: ids[0]! };

	const labels = hints([...cards.values()], groupLabels);
	return {
		kind: 'ambiguous',
		candidates: ids.map((guestId, index) => ({ guestId, hint: labels[index]! }))
	};
}
