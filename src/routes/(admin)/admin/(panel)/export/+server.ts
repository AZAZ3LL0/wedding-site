import { error } from '@sveltejs/kit';
import { buildGuestWorkbook, exportFileName } from '$lib/server/admin/export';
import { listGuestRows } from '$lib/server/admin/repo';
import { getContent } from '$lib/server/content';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

// Endpoints do not run layout loads, so this route checks the guard itself.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.admin) error(404);

	const rows = await listGuestRows(getDb());
	const file = await buildGuestWorkbook(rows, getContent().menu);

	return new Response(new Uint8Array(file), {
		headers: {
			'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'content-disposition': `attachment; filename="${exportFileName(new Date())}"`,
			'cache-control': 'no-store'
		}
	});
};
