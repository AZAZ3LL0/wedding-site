import type { ContentData } from '$lib/content/schema';
import type { GuestPublic } from '$lib/types';

type Guest = Pick<GuestPublic, 'audience' | 'invitedToRegistry' | 'displayName'>;

// All three must agree: a registry exists, the audience sees it, and the party is invited.
export function showsRegistry(
	guest: Guest | null,
	content: Pick<ContentData, 'registry' | 'byAudience'>
): boolean {
	return (
		guest !== null &&
		content.registry !== null &&
		content.byAudience[guest.audience].showRegistry &&
		guest.invitedToRegistry
	);
}

/**
 * The content a site page may receive for this guest. A hidden registry is removed, not just
 * left unrendered, so its address and times never reach the browser.
 */
export function segmentContent(content: ContentData, guest: Guest | null): ContentData {
	return showsRegistry(guest, content) ? content : { ...content, registry: null };
}

export function welcome(guest: Guest, content: Pick<ContentData, 'byAudience'>) {
	return { greeting: content.byAudience[guest.audience].greeting, name: guest.displayName };
}
