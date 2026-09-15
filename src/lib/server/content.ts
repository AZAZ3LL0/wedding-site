import { parseContent, type ContentData } from '$lib/content/schema';
import { content } from '$lib/content/wedding';

let cached: ContentData | undefined;

// Parsed once: hooks.server.ts calls this in init, so a broken wedding.ts stops the start.
export function getContent(): ContentData {
	cached ??= parseContent(content);
	return cached;
}
