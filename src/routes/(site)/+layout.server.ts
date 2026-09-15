import { getContent } from '$lib/server/content';

export const load = () => ({ content: getContent() });
