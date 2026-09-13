import type { Db } from '$lib/server/db';
import { jobReceipts } from '$lib/server/db/schema';

/**
 * Runs `effect` at most once per receipt key, see tech.md §5.
 * The receipt and the effect share a transaction: a failed effect rolls the receipt back so a
 * retry runs it again, and a concurrent duplicate waits on the key and then sees the conflict.
 */
export async function withReceipt(
	db: Db,
	key: string,
	effect: () => Promise<void>
): Promise<'done' | 'duplicate'> {
	return db.transaction(async (tx) => {
		const inserted = await tx
			.insert(jobReceipts)
			.values({ key })
			.onConflictDoNothing()
			.returning({ key: jobReceipts.key });
		if (inserted.length === 0) return 'duplicate';

		await effect();
		return 'done';
	});
}
