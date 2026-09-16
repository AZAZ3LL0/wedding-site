// Session storage key and <html> class. The inline script in src/app.html reads the same name
// before the first paint, so a guest who already opened the envelope never sees it flash.
export const ENVELOPE_OPENED = 'envelope-opened';

// <html> class set once the closed envelope is on screen. Art that only shows later (the card's lace
// and flowers, the roses) waits for it, so the first screen downloads alone on a slow phone instead
// of sharing the connection with everything below it.
export const ENVELOPE_ART = 'envelope-art';

export type Phase = { delay: number; duration: number };
export type OpeningPlan = { seal: Phase; flap: Phase; flowers: Phase; fade: Phase };

// Timings scale with --dur-slow so the envelope keeps pace with the rest of the site's motion.
export function openingPlan(slow: number): OpeningPlan {
	return {
		seal: { delay: 0, duration: slow * 0.6 },
		flap: { delay: slow * 0.45, duration: slow * 1.6 },
		flowers: { delay: slow * 1.3, duration: slow * 1.4 },
		fade: { delay: slow * 2.2, duration: slow * 0.9 }
	};
}

export const end = ({ delay, duration }: Phase) => delay + duration;

// Private mode and blocked storage throw; the envelope then simply shows again next visit.
export function rememberOpened(storage: () => Pick<Storage, 'setItem'>): void {
	try {
		storage().setItem(ENVELOPE_OPENED, '1');
	} catch {
		// Nothing to recover: remembering is a convenience, not a requirement.
	}
}
