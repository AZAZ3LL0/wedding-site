import type { ContentData } from '$lib/content/schema';
import { showsRegistry } from '$lib/server/guests/segment';
import type { GuestPublic, RsvpPayload } from '$lib/types';

export type RsvpRejection =
	| 'companionNotAllowed'
	| 'companionNotAttending'
	| 'unknownOption'
	| 'repeatedOption'
	| 'tooManyCourses';

export type RulesGuest = Pick<
	GuestPublic,
	'audience' | 'invitedToRegistry' | 'plusOnePolicy' | 'displayName'
>;
export type RulesContent = Pick<ContentData, 'menu' | 'registry' | 'byAudience' | 'transfer'>;

// The guest's own rsvps row, as the rules leave it.
export type RsvpAnswer = Omit<RsvpPayload, 'telegramUsername' | 'companion'>;

export type CheckedRsvp = {
	answer: RsvpAnswer;
	telegramUsername: string | null;
	companion: RsvpPayload['companion'];
};

export type CheckResult = { ok: true; value: CheckedRsvp } | { ok: false; reason: RsvpRejection };

function blankToNull(value: string | null): string | null {
	const trimmed = value?.trim() ?? '';
	return trimmed === '' ? null : trimmed;
}

export function normalizeTelegramUsername(value: string | null): string | null {
	return blankToNull(value?.replace(/^[\s@]+/, '') ?? null);
}

function checkMenu(
	courses: string[],
	drinks: string[],
	menu: RulesContent['menu']
): RsvpRejection | null {
	const known = (options: { id: string }[]) => new Set(options.map((o) => o.id));
	const courseIds = known(menu.courses);
	const drinkIds = known(menu.drinks);
	if (!courses.every((id) => courseIds.has(id)) || !drinks.every((id) => drinkIds.has(id))) {
		return 'unknownOption';
	}
	if (new Set(courses).size !== courses.length || new Set(drinks).size !== drinks.length) {
		return 'repeatedOption';
	}
	if (!menu.multiSelect && courses.length > 1) return 'tooManyCourses';
	return null;
}

/**
 * Applies the server rules from tech.md §6 on top of rsvpPayloadSchema. Rejections are about
 * what the guest chose; everything else is normalized so both the web form and the bot store
 * the same shape.
 */
export function checkRsvp(
	payload: RsvpPayload,
	guest: RulesGuest,
	content: RulesContent
): CheckResult {
	const { companion } = payload;
	if (companion && guest.plusOnePolicy === 'none')
		return { ok: false, reason: 'companionNotAllowed' };
	if (companion && payload.attending === 'no') {
		return { ok: false, reason: 'companionNotAttending' };
	}

	const common = {
		songRequest: blankToNull(payload.songRequest),
		comment: blankToNull(payload.comment)
	};
	const telegramUsername = normalizeTelegramUsername(payload.telegramUsername);

	// Menu, registry and transfer only matter to someone who comes, and would skew the counters.
	if (payload.attending === 'no') {
		return {
			ok: true,
			value: {
				answer: {
					attending: 'no',
					attendingRegistry: false,
					mainCourses: [],
					drinks: [],
					allergies: null,
					needsTransfer: false,
					...common
				},
				telegramUsername,
				companion: null
			}
		};
	}

	const rejection =
		checkMenu(payload.mainCourses, payload.drinks, content.menu) ??
		(companion ? checkMenu(companion.mainCourses, companion.drinks, content.menu) : null);
	if (rejection) return { ok: false, reason: rejection };

	return {
		ok: true,
		value: {
			answer: {
				attending: 'yes',
				attendingRegistry: payload.attendingRegistry && showsRegistry(guest, content),
				mainCourses: payload.mainCourses,
				drinks: payload.drinks,
				allergies: blankToNull(payload.allergies),
				needsTransfer: payload.needsTransfer && content.transfer !== null,
				...common
			},
			telegramUsername,
			companion
		}
	};
}
