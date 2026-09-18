import { splitFullName } from '$lib/server/guests/name-key';
import type { Companion } from '$lib/server/rsvp/repo';
import type { RsvpRejection } from '$lib/server/rsvp/service';
import { rsvpPayloadSchema, type RsvpPayload, type RsvpPublic } from '$lib/types';

// What the form shows and posts back. Kept as typed text, so a failed post re-renders it as is.
export type FormValues = {
	name: string;
	attending: 'yes' | 'no' | null;
	companion: boolean;
	companionName: string;
};

// Keys of content.rsvp, so the page looks the message up instead of branching on it.
export type FormError =
	| 'nameRequired'
	| 'attendingRequired'
	| 'companionNameRequired'
	| 'companionNotAttending'
	| 'invalid'
	| 'failed'
	| 'closed';

const fullName = (name: { firstName: string; lastName: string }) =>
	`${name.firstName} ${name.lastName}`.trim();

export function valuesOf(
	name: { firstName: string; lastName: string } | null,
	rsvp: RsvpPublic | null,
	companion: Companion | null
): FormValues {
	return {
		name: name ? fullName(name) : '',
		attending: rsvp?.attending ?? null,
		companion: companion !== null,
		companionName: companion ? fullName(companion) : ''
	};
}

export function readForm(data: FormData): FormValues {
	const text = (name: string) => {
		const value = data.get(name);
		return typeof value === 'string' ? value : '';
	};
	const attending = text('attending');

	return {
		name: text('name'),
		attending: attending === 'yes' || attending === 'no' ? attending : null,
		// A single checkbox is posted only when checked, whatever its value.
		companion: data.has('companion'),
		companionName: text('companionName')
	};
}

export type Submission = { payload: RsvpPayload; name: { firstName: string; lastName: string } };

export function toSubmission(
	values: FormValues
): { ok: true; submission: Submission } | { ok: false; error: FormError } {
	const name = splitFullName(values.name);
	if (name.firstName === '') return { ok: false, error: 'nameRequired' };
	if (values.attending === null) return { ok: false, error: 'attendingRequired' };

	// The page hides the companion block once the guest declines, so a checked toggle left
	// behind is not a request for one.
	const withCompanion = values.attending === 'yes' && values.companion;
	const companion = splitFullName(values.companionName);
	if (withCompanion && companion.firstName === '') {
		return { ok: false, error: 'companionNameRequired' };
	}

	// The form asks nothing else, so every other field of the shared payload keeps its default.
	const parsed = rsvpPayloadSchema.safeParse({
		attending: values.attending,
		companion: withCompanion ? companion : null
	});
	return parsed.success
		? { ok: true, submission: { payload: parsed.data, name } }
		: { ok: false, error: 'invalid' };
}

export function errorOf(reason: RsvpRejection): FormError {
	return reason === 'companionNotAttending' ? reason : 'invalid';
}
