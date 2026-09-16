import type { ContentData } from '$lib/content/schema';
import type { Db } from '$lib/server/db';
import { showsRegistry } from '$lib/server/guests/segment';
import { findGuestPublic } from '$lib/server/guests/repo';
import { findCompanion, findTelegramUsername } from '$lib/server/rsvp/repo';
import { submitRsvp } from '$lib/server/rsvp/service';
import type { GuestPublic, RsvpNotifyAdminJob, RsvpPayload } from '$lib/types';
import { rsvpPayloadSchema } from '$lib/types';
import type { TelegramClient } from './client';
import { bindChat, findGuestByChat, type BoundGuest } from './repo';
import { COURSE_PREFIX, DRINK_PREFIX, commands, templates, type BotContent } from './templates';
import { incoming, type BotCommand, type TelegramUpdate } from './update';

export type BotDeps = {
	db: Db;
	telegram: TelegramClient;
	content: ContentData;
	now?: () => Date;
	// The organizer hears about a bot edit exactly as they hear about a web one (tech.md §5).
	notifyAdmin?: (job: RsvpNotifyAdminJob) => Promise<void>;
};

export type BotOutcome = 'ignored' | 'replied';

/**
 * Handles one update that already passed `telegramUpdateSchema`. The route owns the HTTP
 * contract; everything the bot decides lives here, so a test drives it with a plain update
 * object and a fake client.
 */
export async function handleUpdate(deps: BotDeps, update: TelegramUpdate): Promise<BotOutcome> {
	const message = incoming(update);
	if (!message) return 'ignored';

	const text = await reply(deps, message.chatId, message.command);
	if (text === null) return 'ignored';

	await deps.telegram.sendMessage({ chatId: message.chatId, text });
	return 'replied';
}

async function reply(deps: BotDeps, chatId: number, command: BotCommand): Promise<string | null> {
	const now = deps.now?.() ?? new Date();

	if (command.command === commands.start) {
		return command.argument === ''
			? startWithoutToken(deps, chatId)
			: start(deps, chatId, command.argument, now);
	}

	// Every other command is about the guest's own invitation, so the chat must be bound first.
	const guest = await findGuestByChat(deps.db, chatId);
	if (!guest) return templates.bot.linkNeeded;
	return answer(deps, guest, command, now);
}

async function start(deps: BotDeps, chatId: number, token: string, now: Date): Promise<string> {
	const outcome = await bindChat(deps.db, token, chatId, now);
	if (outcome.kind === 'rejected') return templates.bot.rejected;
	return outcome.kind === 'bound'
		? templates.bot.bound(outcome.guest.displayName)
		: templates.bot.already(outcome.guest.displayName);
}

async function startWithoutToken(deps: BotDeps, chatId: number): Promise<string> {
	const guest = await findGuestByChat(deps.db, chatId);
	return guest ? templates.bot.greeting(guest.displayName) : templates.bot.linkNeeded;
}

async function answer(
	deps: BotDeps,
	guest: BoundGuest,
	command: BotCommand,
	now: Date
): Promise<string> {
	const content = deps.content;
	switch (command.command) {
		case commands.address:
			return templates.bot.address(content, await registryVisible(deps, guest.guestId));
		case commands.timing:
			return templates.bot.timing(content);
		case commands.dressCode:
			return templates.bot.dressCode(content);
		case commands.contacts:
			return templates.bot.contacts(content);
		case commands.rsvp:
			return templates.bot.rsvpState(await readAnswer(deps, guest.guestId), content);
		default:
			return change(deps, guest, command, now);
	}
}

async function registryVisible(deps: BotDeps, guestId: string): Promise<boolean> {
	const guest = await findGuestPublic(deps.db, guestId);
	return guest ? showsRegistry(guest, deps.content) : false;
}

// Everything the bot needs to rebuild a full payload from the answer already on file.
export type BotRsvpState = {
	guest: GuestPublic;
	telegramUsername: string | null;
	companion: RsvpPayload['companion'];
};

async function readAnswer(deps: BotDeps, guestId: string): Promise<{ rsvp: GuestPublic['rsvp'] }> {
	const guest = await findGuestPublic(deps.db, guestId);
	return { rsvp: guest?.rsvp ?? null };
}

async function readState(deps: BotDeps, guestId: string): Promise<BotRsvpState | null> {
	const guest = await findGuestPublic(deps.db, guestId);
	if (!guest) return null;
	const [telegramUsername, companion] = await Promise.all([
		findTelegramUsername(deps.db, guestId),
		findCompanion(deps.db, guestId)
	]);
	return { guest, telegramUsername, companion };
}

export type RsvpDelta =
	| { kind: 'attending'; value: 'yes' | 'no' }
	| { kind: 'course'; id: string }
	| { kind: 'drink'; id: string };

/**
 * Turns the stored answer plus one tap into a full payload for `rsvpPayloadSchema`: the bot has
 * no form and no conversation state, so every change resubmits the whole answer (tech.md §13,
 * 5.4). Fields the guest did not touch, the companion included, come back unchanged.
 */
export function applyDelta(
	state: BotRsvpState,
	delta: RsvpDelta,
	multiSelect: boolean
): RsvpPayload {
	const rsvp = state.guest.rsvp;
	const base = {
		attending: rsvp?.attending ?? 'yes',
		attendingRegistry: rsvp?.attendingRegistry ?? false,
		mainCourses: rsvp?.mainCourses ?? [],
		drinks: rsvp?.drinks ?? [],
		allergies: rsvp?.allergies ?? null,
		needsTransfer: rsvp?.needsTransfer ?? false,
		songRequest: rsvp?.songRequest ?? null,
		comment: rsvp?.comment ?? null,
		telegramUsername: state.telegramUsername,
		companion: state.companion
	} satisfies RsvpPayload;

	if (delta.kind === 'attending') return { ...base, attending: delta.value };
	if (delta.kind === 'course') {
		// One dish unless the menu allows several, matching the web form's radio or checkboxes.
		return { ...base, mainCourses: multiSelect ? toggle(base.mainCourses, delta.id) : [delta.id] };
	}
	return { ...base, drinks: toggle(base.drinks, delta.id) };
}

function toggle(ids: string[], id: string): string[] {
	return ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
}

// Reads `/course_2` as the second dish of the menu; anything out of range is not a choice.
export function menuChoice(
	command: string,
	prefix: string,
	options: { id: string }[]
): string | null {
	if (!command.startsWith(prefix)) return null;
	const index = Number(command.slice(prefix.length));
	if (!Number.isInteger(index)) return null;
	return options[index - 1]?.id ?? null;
}

function deltaOf(command: string, content: BotContent): RsvpDelta | 'unknown' | null {
	if (command === commands.yes) return { kind: 'attending', value: 'yes' };
	if (command === commands.no) return { kind: 'attending', value: 'no' };
	for (const [prefix, options, kind] of [
		[COURSE_PREFIX, content.menu.courses, 'course'],
		[DRINK_PREFIX, content.menu.drinks, 'drink']
	] as const) {
		if (!command.startsWith(prefix)) continue;
		const id = menuChoice(command, prefix, options);
		return id === null ? 'unknown' : { kind, id };
	}
	return null;
}

async function change(
	deps: BotDeps,
	guest: BoundGuest,
	command: BotCommand,
	now: Date
): Promise<string> {
	const content = deps.content;
	const delta = deltaOf(command.command, content);
	if (delta === null) return templates.bot.help;
	if (delta === 'unknown') return templates.bot.unknownChoice(content);

	const state = await readState(deps, guest.guestId);
	if (!state) return templates.bot.linkNeeded;
	// A dish belongs to an answer that exists and says yes; otherwise the guest answers first.
	if (delta.kind !== 'attending' && state.guest.rsvp?.attending !== 'yes') {
		return templates.bot.answerFirst(content);
	}

	const payload = rsvpPayloadSchema.safeParse(applyDelta(state, delta, content.menu.multiSelect));
	if (!payload.success) return templates.bot.rejectedAnswer(content);

	const result = await submitRsvp(deps.db, guest.guestId, payload.data, {
		content,
		source: 'bot',
		now
	});
	if (result.kind === 'closed') return templates.bot.closed(content);
	if (result.kind === 'missing') return templates.bot.linkNeeded;
	if (result.kind === 'rejected') return templates.bot.rejectedAnswer(content);

	// The answer is saved either way, so a queue outage must not turn into an error for the guest.
	try {
		await deps.notifyAdmin?.({
			guestId: guest.guestId,
			kind: result.created ? 'created' : 'updated',
			updatedAt: result.updatedAt
		});
	} catch (error) {
		console.error(`[bot] ${guest.guestId} notice not queued:`, (error as Error).message);
	}

	return templates.bot.saved(
		templates.bot.rsvpState(await readAnswer(deps, guest.guestId), content)
	);
}
