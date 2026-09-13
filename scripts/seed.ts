// Dev and test data covering every case from tech.md §10. Run with `pnpm db:seed`.
// Explicit .ts extensions let Node run this file without a build step.
import { createDb, type Db } from '../src/lib/server/db/index.ts';
import { guests, parties } from '../src/lib/server/db/schema.ts';
import { nameKey } from '../src/lib/server/guests/name-key.ts';

type PartyRow = typeof parties.$inferInsert & { id: string };
type GuestRow = typeof guests.$inferInsert & { id: string };

// Fixed ids make reseeding an update instead of a second copy.
const id = {
	ivanovs: '00000000-0000-4000-8000-000000000001',
	petrov: '00000000-0000-4000-8000-000000000002',
	kozlov: '00000000-0000-4000-8000-000000000003',
	sidorovaColleague: '00000000-0000-4000-8000-000000000004',
	sidorovaFamily: '00000000-0000-4000-8000-000000000005'
};

export const seedParties: PartyRow[] = [
	{
		id: id.ivanovs,
		title: 'Семья Ивановых',
		audience: 'family',
		plusOnePolicy: 'none',
		invitedToRegistry: true
	},
	{
		id: id.petrov,
		title: 'Алексей Петров с парой',
		audience: 'friends',
		plusOnePolicy: 'allowed',
		invitedToRegistry: false
	},
	{
		id: id.kozlov,
		title: 'Дмитрий Козлов',
		audience: 'friends',
		plusOnePolicy: 'allowed',
		invitedToRegistry: false,
		note: 'Plus one allowed but not declared yet'
	},
	{
		id: id.sidorovaColleague,
		title: 'Анна Сидорова, коллега',
		audience: 'colleagues',
		plusOnePolicy: 'none',
		invitedToRegistry: false
	},
	{
		id: id.sidorovaFamily,
		title: 'Анна Сидорова, двоюродная сестра',
		audience: 'family',
		plusOnePolicy: 'none',
		invitedToRegistry: true,
		note: 'Namesake of the colleague, exercises ambiguous matching'
	}
];

function guest(
	row: Omit<GuestRow, 'nameKey' | 'displayName'> & { displayName?: string }
): GuestRow {
	return {
		...row,
		displayName: row.displayName ?? row.firstName,
		nameKey: nameKey(`${row.firstName} ${row.lastName}`)
	};
}

const petrovId = '00000000-0000-4000-8000-000000000102';

export const seedGuests: GuestRow[] = [
	guest({
		id: '00000000-0000-4000-8000-000000000101',
		partyId: id.ivanovs,
		firstName: 'Иван',
		lastName: 'Иванов',
		telegramUsername: 'ivan_ivanov',
		telegramChatId: 100000001,
		botToken: 'seed-token-ivan-ivanov',
		botStartedAt: new Date('2026-09-01T10:00:00Z')
	}),
	guest({
		id: '00000000-0000-4000-8000-000000000103',
		partyId: id.ivanovs,
		firstName: 'Мария',
		lastName: 'Иванова',
		botToken: 'seed-token-maria-ivanova'
	}),
	guest({
		id: petrovId,
		partyId: id.petrov,
		firstName: 'Алексей',
		lastName: 'Петров',
		displayName: 'Лёша',
		botToken: 'seed-token-alexey-petrov'
	}),
	guest({
		id: '00000000-0000-4000-8000-000000000104',
		partyId: id.petrov,
		firstName: 'Ольга',
		lastName: 'Смирнова',
		isPlusOne: true,
		invitedByGuestId: petrovId,
		botToken: 'seed-token-olga-smirnova'
	}),
	guest({
		id: '00000000-0000-4000-8000-000000000105',
		partyId: id.kozlov,
		firstName: 'Дмитрий',
		lastName: 'Козлов',
		botToken: 'seed-token-dmitry-kozlov'
	}),
	guest({
		id: '00000000-0000-4000-8000-000000000106',
		partyId: id.sidorovaColleague,
		firstName: 'Анна',
		lastName: 'Сидорова',
		displayName: 'Анна Сергеевна',
		botToken: 'seed-token-anna-sidorova-colleague'
	}),
	guest({
		id: '00000000-0000-4000-8000-000000000107',
		partyId: id.sidorovaFamily,
		firstName: 'Анна',
		lastName: 'Сидорова',
		displayName: 'Аня',
		botToken: 'seed-token-anna-sidorova-family'
	})
];

// Upserts by primary key and never deletes, so it is safe to rerun on a database with other rows.
export async function seed(db: Db): Promise<void> {
	await db.transaction(async (tx) => {
		for (const party of seedParties) {
			await tx.insert(parties).values(party).onConflictDoUpdate({ target: parties.id, set: party });
		}
		for (const row of seedGuests) {
			await tx.insert(guests).values(row).onConflictDoUpdate({ target: guests.id, set: row });
		}
	});
}

if (import.meta.main) {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error('DATABASE_URL is not set');
		process.exit(1);
	}
	const { db, close } = createDb(url);
	try {
		await seed(db);
		console.log(`seeded ${seedParties.length} parties and ${seedGuests.length} guests`);
	} finally {
		await close();
	}
}
