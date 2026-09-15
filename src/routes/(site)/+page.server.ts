import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { z } from 'zod';
import { getConfig } from '$lib/server/config';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import {
	chooseCard,
	enter,
	register,
	type EntryName,
	type KnownCard
} from '$lib/server/guests/entry';
import type { GroupLabels } from '$lib/server/guests/match';
import { startSession } from '$lib/server/guests/session';
import type { Actions, PageServerLoad } from './$types';

const namePart = z.string().trim().min(1).max(60);
const nameForm = z.object({ firstName: namePart, lastName: namePart });
const chooseForm = nameForm.extend({ guestId: z.uuid() });

type Status = 'invalid' | 'known' | 'failed';

// One shape for every outcome, so the page reads any field without narrowing on the action.
function state(
	status: Status,
	name: EntryName,
	{ cards = [] as KnownCard[], missing = { firstName: false, lastName: false } } = {}
) {
	return { status, ...name, cards, missing };
}

function typedName(data: Record<string, FormDataEntryValue>): EntryName {
	const text = (value: FormDataEntryValue | undefined) => (typeof value === 'string' ? value : '');
	return { firstName: text(data.firstName), lastName: text(data.lastName) };
}

function invalid(data: Record<string, FormDataEntryValue>) {
	const name = typedName(data);
	return fail(
		400,
		state('invalid', name, {
			missing: {
				firstName: !namePart.safeParse(name.firstName).success,
				lastName: !namePart.safeParse(name.lastName).success
			}
		})
	);
}

function groupLabels(): GroupLabels {
	const { byAudience } = getContent();
	return {
		family: byAudience.family.label,
		friends: byAudience.friends.label,
		colleagues: byAudience.colleagues.label
	};
}

async function signIn(cookies: Cookies, guestId: string): Promise<never> {
	await startSession(getDb(), cookies, guestId, { secure: getConfig().isProduction });
	redirect(303, '/i');
}

async function readForm(request: Request) {
	return Object.fromEntries(await request.formData());
}

export const load: PageServerLoad = ({ locals }) => {
	if (locals.guest) redirect(303, '/i');
};

export const actions: Actions = {
	register: async ({ request, cookies }) => {
		const data = await readForm(request);
		const parsed = nameForm.safeParse(data);
		if (!parsed.success) return invalid(data);

		let guestId: string;
		try {
			const result = await enter(getDb(), parsed.data, groupLabels());
			if (result.kind === 'known') return state('known', parsed.data, { cards: result.cards });
			guestId = result.guestId;
		} catch (error) {
			console.error('[entry] registration failed:', (error as Error).message);
			return fail(500, state('failed', parsed.data));
		}
		return signIn(cookies, guestId);
	},

	choose: async ({ request, cookies }) => {
		const data = await readForm(request);
		const parsed = chooseForm.safeParse(data);
		if (!parsed.success) return invalid(data);
		const { guestId, ...name } = parsed.data;

		const choice = await chooseCard(getDb(), name, guestId, groupLabels());
		if (choice.allowed) return signIn(cookies, guestId);
		return fail(400, state('known', name, { cards: choice.cards }));
	},

	// «Это не я»: the guest has seen the matching cards and asks for one of their own.
	new: async ({ request, cookies }) => {
		const data = await readForm(request);
		const parsed = nameForm.safeParse(data);
		if (!parsed.success) return invalid(data);

		let guestId: string;
		try {
			guestId = await register(getDb(), parsed.data);
		} catch (error) {
			console.error('[entry] registration failed:', (error as Error).message);
			return fail(500, state('failed', parsed.data));
		}
		return signIn(cookies, guestId);
	}
};
