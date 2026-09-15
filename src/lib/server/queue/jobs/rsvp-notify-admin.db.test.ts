import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { parseContent } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import { createDb } from '$lib/server/db';
import { guests, jobReceipts, parties } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { submitRsvp, type SubmitContent } from '$lib/server/rsvp/service';
import { TelegramError } from '$lib/server/telegram/client';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import {
	rsvpNotifyAdminJobSchema,
	rsvpPayloadSchema,
	type RsvpNotifyAdminJob,
	type RsvpPayload
} from '$lib/types';
import { InvalidPayloadError } from '../errors';
import { handleRsvpNotifyAdmin } from './rsvp-notify-admin';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

const adminChatId = -100800;
const base = parseContent(raw);
const content: SubmitContent = {
	...base,
	menu: {
		multiSelect: false,
		courses: [{ id: 'plov', label: 'Плов' }],
		drinks: [
			{ id: 'tea', label: 'Чай' },
			{ id: 'juice', label: 'Сок' }
		]
	}
};

function setup() {
	const telegram = new FakeTelegramClient();
	return { telegram, deps: { db, telegram, adminChatId, menu: content.menu } };
}

async function newGuest() {
	const suffix = randomUUID().slice(0, 8);
	const [party] = await db
		.insert(parties)
		.values({ title: `Семья ${suffix}`, audience: 'friends', plusOnePolicy: 'allowed' })
		.returning({ id: parties.id });
	const lastName = `Гостев${suffix}`;
	const [guest] = await db
		.insert(guests)
		.values({
			partyId: party!.id,
			firstName: 'Пётр',
			lastName,
			displayName: 'Петя',
			nameKey: nameKey(`Пётр ${lastName}`),
			botToken: randomUUID()
		})
		.returning({ id: guests.id });
	return { guestId: guest!.id, name: `Пётр ${lastName}`, partyTitle: `Семья ${suffix}` };
}

// Saves an answer the way the form does and returns the job the action would queue.
async function answer(
	guestId: string,
	overrides: Partial<RsvpPayload>
): Promise<RsvpNotifyAdminJob> {
	const result = await submitRsvp(
		db,
		guestId,
		rsvpPayloadSchema.parse({ attending: 'yes', ...overrides }),
		{ content, source: 'web', now: new Date('2026-10-01T12:00:00+04:00') }
	);
	if (result.kind !== 'saved') throw new Error(`answer not saved: ${result.kind}`);
	return { guestId, kind: result.created ? 'created' : 'updated', updatedAt: result.updatedAt };
}

async function receiptExists(job: RsvpNotifyAdminJob) {
	const key = `rsvp.notify-admin:${job.guestId}:${job.kind}:${job.updatedAt}`;
	return (await db.select().from(jobReceipts).where(eq(jobReceipts.key, key))).length === 1;
}

describe('rsvp.notify-admin handler', () => {
	it('tells the admin chat who answered and what they chose', async () => {
		const { telegram, deps } = setup();
		const { guestId, name, partyTitle } = await newGuest();
		const job = await answer(guestId, {
			mainCourses: ['plov'],
			drinks: ['tea', 'juice'],
			allergies: 'орехи',
			comment: 'Приедем к шести',
			telegramUsername: '@petr_g',
			companion: { firstName: 'Анна', lastName: 'Гостева', mainCourses: ['plov'], drinks: [] }
		});

		await expect(handleRsvpNotifyAdmin(deps, job)).resolves.toBe('sent');

		expect(telegram.sent).toHaveLength(1);
		const [message] = telegram.sent;
		expect(message).toMatchObject({ chatId: adminChatId });
		for (const part of [
			'Новый ответ',
			name,
			partyTitle,
			'Придёт: да',
			'Горячее: Плов',
			'Напитки: Чай, Сок',
			'Аллергии: орехи',
			'Комментарий: Приедем к шести',
			'@petr_g',
			'Спутник: Анна Гостева'
		]) {
			expect(message?.text).toContain(part);
		}
	});

	it('queues a payload that passes the job schema, built from what submitRsvp returns', async () => {
		const { guestId } = await newGuest();
		const job = await answer(guestId, {});
		expect(rsvpNotifyAdminJobSchema.parse(job)).toEqual(job);
	});

	it('keeps the longest answer the schema allows within the Telegram text limit', async () => {
		const { telegram, deps } = setup();
		const { guestId } = await newGuest();
		const job = await answer(guestId, {
			allergies: 'а'.repeat(300),
			comment: 'б'.repeat(1000),
			telegramUsername: 'u'.repeat(64),
			mainCourses: ['plov'],
			drinks: ['tea', 'juice'],
			companion: {
				firstName: 'в'.repeat(60),
				lastName: 'г'.repeat(60),
				mainCourses: ['plov'],
				drinks: ['tea', 'juice']
			}
		});

		// The fake client rejects text over 4096 characters, like the Bot API.
		await expect(handleRsvpNotifyAdmin(deps, job)).resolves.toBe('sent');
		expect(telegram.sent).toHaveLength(1);
	});

	it('marks a changed answer and leaves the menu out of a no', async () => {
		const { telegram, deps } = setup();
		const { guestId } = await newGuest();
		await answer(guestId, { drinks: ['tea'] });
		const job = await answer(guestId, { attending: 'no' });

		expect(job.kind).toBe('updated');
		await handleRsvpNotifyAdmin(deps, job);

		expect(telegram.sent[0]?.text).toContain('изменил ответ');
		expect(telegram.sent[0]?.text).toContain('Придёт: нет');
		expect(telegram.sent[0]?.text).not.toContain('Напитки');
	});

	it('is idempotent: two runs with the same payload give exactly one message', async () => {
		const { telegram, deps } = setup();
		const { guestId } = await newGuest();
		const job = await answer(guestId, {});

		await handleRsvpNotifyAdmin(deps, job);
		await expect(handleRsvpNotifyAdmin(deps, job)).resolves.toBe('duplicate');

		expect(telegram.sent).toHaveLength(1);
		expect(await receiptExists(job)).toBe(true);
	});

	it('is idempotent under concurrent runs', async () => {
		const { telegram, deps } = setup();
		const { guestId } = await newGuest();
		const job = await answer(guestId, {});

		const outcomes = await Promise.all([
			handleRsvpNotifyAdmin(deps, job),
			handleRsvpNotifyAdmin(deps, job)
		]);

		expect(outcomes.sort()).toEqual(['duplicate', 'sent']);
		expect(telegram.sent).toHaveLength(1);
	});

	it('sends again for a later change of the same answer', async () => {
		const { telegram, deps } = setup();
		const { guestId } = await newGuest();
		const first = await answer(guestId, {});
		const second = await answer(guestId, { drinks: ['juice'] });

		await handleRsvpNotifyAdmin(deps, first);
		await handleRsvpNotifyAdmin(deps, second);
		await handleRsvpNotifyAdmin(deps, second);

		expect(telegram.sent).toHaveLength(2);
	});

	it.each(['server', 'timeout', 'rejected'] as const)(
		'a %s error rolls the receipt back, so a retry still sends once',
		async (kind) => {
			const { telegram, deps } = setup();
			const { guestId } = await newGuest();
			const job = await answer(guestId, {});
			telegram.failNext(kind);

			const error = await handleRsvpNotifyAdmin(deps, job).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(TelegramError);
			expect((error as TelegramError).kind).toBe(kind);
			expect(await receiptExists(job)).toBe(false);

			await expect(handleRsvpNotifyAdmin(deps, job)).resolves.toBe('sent');
			await expect(handleRsvpNotifyAdmin(deps, job)).resolves.toBe('duplicate');
			expect(telegram.sent).toHaveLength(1);
		}
	);

	it('finishes without a message when the guest is gone', async () => {
		const { telegram, deps } = setup();
		const { guestId } = await newGuest();
		const job = await answer(guestId, {});
		await db.delete(guests).where(eq(guests.id, guestId));

		await expect(handleRsvpNotifyAdmin(deps, job)).resolves.toBe('missing');
		expect(telegram.sent).toHaveLength(0);
	});

	it('finishes without a message for a guest who never answered', async () => {
		const { telegram, deps } = setup();
		const { guestId } = await newGuest();
		const job = { guestId, kind: 'created', updatedAt: new Date().toISOString() } as const;

		await expect(handleRsvpNotifyAdmin(deps, job)).resolves.toBe('missing');
		expect(telegram.sent).toHaveLength(0);
	});

	it.each([
		['a missing guestId', { kind: 'created', updatedAt: '2026-10-01T08:00:00.000Z' }],
		[
			'a guestId that is not a uuid',
			{ guestId: 'g-1', kind: 'created', updatedAt: '2026-10-01T08:00:00.000Z' }
		],
		[
			'an unknown kind',
			{ guestId: randomUUID(), kind: 'deleted', updatedAt: '2026-10-01T08:00:00.000Z' }
		],
		['a missing updatedAt', { guestId: randomUUID(), kind: 'updated' }],
		['a date without time', { guestId: randomUUID(), kind: 'updated', updatedAt: '2026-10-01' }],
		['a null payload', null]
	])('rejects %s without sending', async (_, payload) => {
		const { telegram, deps } = setup();

		await expect(handleRsvpNotifyAdmin(deps, payload)).rejects.toBeInstanceOf(InvalidPayloadError);
		expect(telegram.sent).toHaveLength(0);
	});
});
