import { getContent } from '$lib/server/content';
import { segmentContent } from '$lib/server/guests/segment';

export const load = ({ locals }) => ({ content: segmentContent(getContent(), locals.guest) });
