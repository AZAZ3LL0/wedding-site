import {
	pgTable,
	pgEnum,
	uuid,
	text,
	boolean,
	timestamp,
	bigint,
	jsonb,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';

export const audienceEnum = pgEnum('audience', ['family', 'friends', 'colleagues']);
export const plusOnePolicyEnum = pgEnum('plus_one_policy', ['none', 'allowed']);
export const attendStatusEnum = pgEnum('attend_status', ['yes', 'no']);
export const reminderStageEnum = pgEnum('reminder_stage', ['d30', 'd7']);
export const reminderStatusEnum = pgEnum('reminder_status', ['sent', 'skipped', 'failed']);

// A family or a couple. Guests of one party share an invitation and see each other in the form.
export const parties = pgTable('parties', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(), // internal label, never shown to guests
	audience: audienceEnum('audience').notNull(),
	plusOnePolicy: plusOnePolicyEnum('plus_one_policy').notNull().default('none'),
	invitedToRegistry: boolean('invited_to_registry').notNull().default(false),
	note: text('note'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const guests = pgTable(
	'guests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		partyId: uuid('party_id')
			.notNull()
			.references(() => parties.id, { onDelete: 'cascade' }),
		firstName: text('first_name').notNull(),
		lastName: text('last_name').notNull(),
		displayName: text('display_name').notNull(), // how the site addresses the guest
		nameKey: text('name_key').notNull(), // normalized key, see guests/name-key.ts
		isPlusOne: boolean('is_plus_one').notNull().default(false),
		invitedByGuestId: uuid('invited_by_guest_id'), // self-ref, set only for a companion
		telegramUsername: text('telegram_username'),
		telegramChatId: bigint('telegram_chat_id', { mode: 'number' }),
		botToken: text('bot_token').notNull(), // payload for t.me/<bot>?start=<token>
		botStartedAt: timestamp('bot_started_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		nameKeyIdx: index('guests_name_key_idx').on(t.nameKey),
		partyIdx: index('guests_party_idx').on(t.partyId),
		botTokenIdx: uniqueIndex('guests_bot_token_idx').on(t.botToken),
		chatIdIdx: uniqueIndex('guests_chat_id_idx').on(t.telegramChatId)
	})
);

export const rsvps = pgTable(
	'rsvps',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		guestId: uuid('guest_id')
			.notNull()
			.references(() => guests.id, { onDelete: 'cascade' }),
		attending: attendStatusEnum('attending').notNull(),
		attendingRegistry: boolean('attending_registry').notNull().default(false),
		mainCourses: jsonb('main_courses').$type<string[]>().notNull().default([]), // ids from content.menu
		drinks: jsonb('drinks').$type<string[]>().notNull().default([]),
		allergies: text('allergies'),
		needsTransfer: boolean('needs_transfer').notNull().default(false),
		songRequest: text('song_request'),
		comment: text('comment'),
		source: text('source').notNull(), // 'web' | 'bot'
		submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		guestIdx: uniqueIndex('rsvps_guest_idx').on(t.guestId)
	})
);

// A sent reminder. The unique key keeps the send job idempotent.
export const reminders = pgTable(
	'reminders',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		guestId: uuid('guest_id')
			.notNull()
			.references(() => guests.id, { onDelete: 'cascade' }),
		stage: reminderStageEnum('stage').notNull(),
		status: reminderStatusEnum('status').notNull(),
		error: text('error'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		dedupeIdx: uniqueIndex('reminders_dedupe_idx').on(t.guestId, t.stage)
	})
);

// A name that matched nobody. The organizer resolves it in the admin.
export const unknownRequests = pgTable('unknown_requests', {
	id: uuid('id').primaryKey().defaultRandom(),
	rawName: text('raw_name').notNull(),
	contact: text('contact'),
	resolvedAt: timestamp('resolved_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const guestSessions = pgTable('guest_sessions', {
	id: text('id').primaryKey(), // random token from the cookie
	guestId: uuid('guest_id')
		.notNull()
		.references(() => guests.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
