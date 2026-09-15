import type { Companion } from '$lib/server/rsvp/repo';
import type { RsvpRejection } from '$lib/server/rsvp/service';
import { rsvpPayloadSchema, type RsvpPayload, type RsvpPublic } from '$lib/types';

// What the form shows and posts back. Kept as typed text, so a failed post re-renders it as is.
export type FormValues = {
	attending: 'yes' | 'no' | null;
	attendingRegistry: boolean;
	mainCourses: string[];
	drinks: string[];
	allergies: string;
	needsTransfer: boolean;
	comment: string;
	telegramUsername: string;
	companion: boolean;
	companionFirstName: string;
	companionLastName: string;
	companionCourses: string[];
	companionDrinks: string[];
};

// Keys of content.rsvp, so the page looks the message up instead of branching on it.
export type FormError =
	| 'attendingRequired'
	| 'companionNameRequired'
	| 'companionNotAttending'
	| 'unknownOption'
	| 'invalid'
	| 'failed'
	| 'closed';

export function valuesOf(
	rsvp: RsvpPublic | null,
	telegramUsername: string | null,
	companion: Companion | null
): FormValues {
	return {
		attending: rsvp?.attending ?? null,
		attendingRegistry: rsvp?.attendingRegistry ?? false,
		mainCourses: rsvp?.mainCourses ?? [],
		drinks: rsvp?.drinks ?? [],
		allergies: rsvp?.allergies ?? '',
		needsTransfer: rsvp?.needsTransfer ?? false,
		comment: rsvp?.comment ?? '',
		telegramUsername: telegramUsername ? `@${telegramUsername}` : '',
		companion: companion !== null,
		companionFirstName: companion?.firstName ?? '',
		companionLastName: companion?.lastName ?? '',
		companionCourses: companion?.mainCourses ?? [],
		companionDrinks: companion?.drinks ?? []
	};
}

export function readForm(data: FormData): FormValues {
	const text = (name: string) => {
		const value = data.get(name);
		return typeof value === 'string' ? value : '';
	};
	const list = (name: string) =>
		data.getAll(name).filter((value): value is string => typeof value === 'string');
	const attending = text('attending');

	return {
		attending: attending === 'yes' || attending === 'no' ? attending : null,
		// A single checkbox is posted only when checked, whatever its value.
		attendingRegistry: data.has('attendingRegistry'),
		mainCourses: list('mainCourses'),
		drinks: list('drinks'),
		allergies: text('allergies'),
		needsTransfer: data.has('needsTransfer'),
		comment: text('comment'),
		telegramUsername: text('telegramUsername'),
		companion: data.has('companion'),
		companionFirstName: text('companionFirstName'),
		companionLastName: text('companionLastName'),
		companionCourses: list('companionCourses'),
		companionDrinks: list('companionDrinks')
	};
}

export function toPayload(
	values: FormValues
): { ok: true; payload: RsvpPayload } | { ok: false; error: FormError } {
	if (values.attending === null) return { ok: false, error: 'attendingRequired' };

	// The page hides the companion block once the guest declines, so a checked toggle left
	// behind is not a request for one.
	const withCompanion = values.attending === 'yes' && values.companion;
	const firstName = values.companionFirstName.trim();
	if (withCompanion && firstName === '') return { ok: false, error: 'companionNameRequired' };

	const parsed = rsvpPayloadSchema.safeParse({
		attending: values.attending,
		attendingRegistry: values.attendingRegistry,
		mainCourses: values.mainCourses,
		drinks: values.drinks,
		allergies: values.allergies || null,
		needsTransfer: values.needsTransfer,
		comment: values.comment || null,
		telegramUsername: values.telegramUsername || null,
		companion: withCompanion
			? {
					firstName,
					lastName: values.companionLastName.trim(),
					mainCourses: values.companionCourses,
					drinks: values.companionDrinks
				}
			: null
	});
	return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, error: 'invalid' };
}

export function errorOf(reason: RsvpRejection): FormError {
	return reason === 'unknownOption' || reason === 'companionNotAttending' ? reason : 'invalid';
}
