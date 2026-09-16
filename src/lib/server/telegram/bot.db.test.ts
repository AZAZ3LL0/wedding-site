import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { parseContent, type ContentData } from '$lib/content/schema';
import { content as raw } from '$lib/content/wedding';
import { createDb } from '$lib/server/db';
import { guests, parties } from '$lib/server/db/schema';
import { nameKey } from '$lib/server/guests/name-key';
import { FakeTelegramClient } from '$lib/server/telegram/fake';
import { handleUpdate, type BotDeps } from './bot';
import { telegramUpdateSchema } from './update';

const { db, close } = createDb(inject('databaseUrl'));
afterAll(() => close());

const base = parseContent(raw);
const content: ContentData = {
	...base,
	venue: {
		...base.venue,
		title: 'Зал «Европейский»',
		address: 'Каспийская 2Б',
		startTime: '17:00'
	},
	timeline: [{ time: '18:00', title: 'Ужин', caption: 'Горячее и тосты', icon: 'dish' }],
	dressCode: { text: 'Вечерние наряды', palette: [{ hex: '#6e6b3c', name: 'олива' }] },
	contacts: [{ role: 'Организатор', name: 'Алина', phone: '+7 999 000-00-00', telegram: null }],
	menu: {
		multiSelect: false,
		courses: [
			{ id: 'plov', label: 'Плов' },
			{ id: 'fish', label: 'Рыба' }
		],
		drinks: [
			{ id: 'tea', label: 'Чай' },
			{ id: 'juice', label: 'Сок' }
		]
	}
};

// Well before the seeded rsvpDeadline, so a bot edit is never refused for being late.
const now = () => new Date('2026-10-01T12:00:00+04:00');

let telegram: FakeTelegramClient;
let deps: BotDeps;

beforeEach(() => {
	telegram = new FakeTelegramClient();
	deps = { db, telegram, content, now };
});

let chatSeq = 900_000;
const newChatId = () => ++chatSeq;

async function newGuest(options: { isPlusOne?: boolean; chatId?: number } = {}) {
	const suffix = randomUUID().slice(0, 8);
	const [party] = await db
		.insert(parties)
		.values({ title: `Гости ${suffix}`, audience: 'friends', plusOnePolicy: 'allowed' })
		.returning({ id: parties.id });
	const botToken = `token-${suffix}`;
	const [guest] = await db
		.insert(guests)
		.values({
			partyId: party!.id,
			firstName: 'Пётр',
			lastName: `Гостев${suffix}`,
			displayName: 'Петя',
			nameKey: nameKey(`Пётр Гостев${suffix}`),
			isPlusOne: options.isPlusOne ?? false,
			telegramChatId: options.chatId ?? null,
			botToken
		})
		.returning({ id: guests.id });
	return { guestId: guest!.id, botToken };
}

function update(text: string, chatId: number) {
	return telegramUpdateSchema.parse({
		update_id: chatSeq,
		message: { message_id: 1, chat: { id: chatId, type: 'private' }, text }
	});
}

const send = (text: string, chatId: number) => handleUpdate(deps, update(text, chatId));

const lastText = () => telegram.sent.at(-1)?.text ?? '';

async function chatIdOf(guestId: string) {
	const [row] = await db
		.select({ chatId: guests.telegramChatId, startedAt: guests.botStartedAt })
		.from(guests)
		.where(eq(guests.id, guestId));
	return row!;
}

describe('/start binding', () => {
	it('binds the chat that opens the personal deep link', async () => {
		const { guestId, botToken } = await newGuest();
		const chatId = newChatId();

		await expect(send(`/start ${botToken}`, chatId)).resolves.toBe('replied');

		const row = await chatIdOf(guestId);
		expect(row.chatId).toBe(chatId);
		expect(row.startedAt).toEqual(now());
		expect(telegram.sent).toHaveLength(1);
		expect(lastText()).toContain('Петя');
	});

	it('is idempotent: a second /start does not create a second binding', async () => {
		const { guestId, botToken } = await newGuest();
		const chatId = newChatId();

		await send(`/start ${botToken}`, chatId);
		await send(`/start ${botToken}`, chatId);

		expect(await chatIdOf(guestId)).toMatchObject({ chatId });
		const bound = await db.select().from(guests).where(eq(guests.telegramChatId, chatId));
		expect(bound).toHaveLength(1);
		expect(lastText()).toContain('уже подключены');
	});

	it('keeps the first bot_started_at when the guest taps the link again', async () => {
		const { guestId, botToken } = await newGuest();
		const chatId = newChatId();

		await send(`/start ${botToken}`, chatId);
		deps = { ...deps, now: () => new Date('2026-10-05T12:00:00+04:00') };
		await send(`/start ${botToken}`, chatId);

		expect((await chatIdOf(guestId)).startedAt).toEqual(now());
	});

	it('rejects a token no guest owns', async () => {
		const chatId = newChatId();

		await send('/start not-a-real-token', chatId);

		expect(lastText()).toContain('не подошла');
		expect(await db.select().from(guests).where(eq(guests.telegramChatId, chatId))).toHaveLength(0);
	});

	it("rejects another guest's token once that guest is bound", async () => {
		const owner = await newGuest();
		await send(`/start ${owner.botToken}`, newChatId());

		const intruder = newChatId();
		await send(`/start ${owner.botToken}`, intruder);

		expect(lastText()).toContain('не подошла');
		expect(await db.select().from(guests).where(eq(guests.telegramChatId, intruder))).toHaveLength(
			0
		);
	});

	it('rejects a second guest binding a chat that already belongs to someone', async () => {
		const first = await newGuest();
		const second = await newGuest();
		const chatId = newChatId();
		await send(`/start ${first.botToken}`, chatId);

		await send(`/start ${second.botToken}`, chatId);

		expect(lastText()).toContain('не подошла');
		expect((await chatIdOf(second.guestId)).chatId).toBeNull();
	});

	it('rejects a companion token: a companion has no card of their own', async () => {
		const { guestId, botToken } = await newGuest({ isPlusOne: true });

		await send(`/start ${botToken}`, newChatId());

		expect(lastText()).toContain('не подошла');
		expect((await chatIdOf(guestId)).chatId).toBeNull();
	});

	it('greets a bound guest who sends a bare /start', async () => {
		const { botToken } = await newGuest();
		const chatId = newChatId();
		await send(`/start ${botToken}`, chatId);

		await send('/start', chatId);

		expect(lastText()).toContain('рады видеть');
	});

	it('asks an unknown chat for its personal link', async () => {
		await send('/start', newChatId());

		expect(lastText()).toContain('персональную ссылку');
	});
});

describe('bot commands', () => {
	it('answers the address with the venue from the content config', async () => {
		const chatId = newChatId();
		await newGuest({ chatId });

		await send('/address', chatId);

		expect(lastText()).toContain('Зал «Европейский»');
		expect(lastText()).toContain('Каспийская 2Б');
		expect(lastText()).toContain('Сбор гостей в 17:00');
	});

	it('leaves the registry out while content.registry is null', async () => {
		const chatId = newChatId();
		await newGuest({ chatId });

		await send('/address', chatId);

		expect(lastText()).not.toContain('ЗАГС');
	});

	it('answers the timing from the content timeline', async () => {
		const chatId = newChatId();
		await newGuest({ chatId });

		await send('/timing', chatId);

		expect(lastText()).toContain('18:00 — Ужин');
		expect(lastText()).toContain('Горячее и тосты');
	});

	it('answers the dress code with its palette', async () => {
		const chatId = newChatId();
		await newGuest({ chatId });

		await send('/dresscode', chatId);

		expect(lastText()).toContain('Вечерние наряды');
		expect(lastText()).toContain('олива');
	});

	it('answers the contacts', async () => {
		const chatId = newChatId();
		await newGuest({ chatId });

		await send('/contacts', chatId);

		expect(lastText()).toContain('Организатор: Алина');
		expect(lastText()).toContain('+7 999 000-00-00');
	});

	it('falls back to help for a command it does not know', async () => {
		const chatId = newChatId();
		await newGuest({ chatId });

		await send('/weather', chatId);

		expect(lastText()).toContain('Что я умею');
	});

	it('sends nothing for a message that is not a command', async () => {
		const chatId = newChatId();
		await newGuest({ chatId });

		await expect(send('доброе утро', chatId)).resolves.toBe('ignored');
		expect(telegram.sent).toHaveLength(0);
	});

	it('asks an unbound chat for its personal link instead of answering', async () => {
		await send('/address', newChatId());

		expect(lastText()).toContain('персональную ссылку');
	});
});
