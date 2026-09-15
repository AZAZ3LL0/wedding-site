import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENVELOPE_OPENED, end, openingPlan, rememberOpened } from './envelope';

const slow = fc.integer({ min: 1, max: 5000 });

describe('openingPlan', () => {
	it('lets the seal go before the flap swings far', () => {
		fc.assert(
			fc.property(slow, (s) => {
				const { seal, flap } = openingPlan(s);
				expect(end(seal)).toBeLessThanOrEqual(flap.delay + flap.duration * 0.3);
			})
		);
	});

	it('starts the card only after the flap has passed upright', () => {
		fc.assert(
			fc.property(slow, (s) => {
				const { flap, card } = openingPlan(s);
				expect(card.delay).toBeGreaterThanOrEqual(flap.delay + flap.duration / 2);
			})
		);
	});

	it('fades the envelope only after the card has risen', () => {
		fc.assert(
			fc.property(slow, (s) => {
				const { card, fade } = openingPlan(s);
				expect(fade.delay).toBeGreaterThanOrEqual(end(card));
			})
		);
	});

	it('scales linearly with the slow duration token', () => {
		fc.assert(
			fc.property(slow, fc.integer({ min: 1, max: 10 }), (s, k) => {
				expect(end(openingPlan(s * k).fade)).toBeCloseTo(end(openingPlan(s).fade) * k, 6);
			})
		);
	});
});

describe('rememberOpened', () => {
	it('stores the flag under the shared key', () => {
		const stored = new Map<string, string>();
		rememberOpened(() => ({ setItem: (k: string, v: string) => void stored.set(k, v) }));
		expect(stored.get(ENVELOPE_OPENED)).toBe('1');
	});

	it('swallows storage that throws', () => {
		expect(() =>
			rememberOpened(() => {
				throw new DOMException('denied', 'SecurityError');
			})
		).not.toThrow();
		expect(() =>
			rememberOpened(() => ({
				setItem: () => {
					throw new DOMException('full', 'QuotaExceededError');
				}
			}))
		).not.toThrow();
	});
});

describe('app.html', () => {
	it('reads the same key the envelope writes, before the first paint', () => {
		const html = readFileSync('src/app.html', 'utf8');
		const head = html.slice(0, html.indexOf('%sveltekit.head%'));
		expect(head).toContain(`sessionStorage.getItem('${ENVELOPE_OPENED}')`);
		expect(head).toContain(`classList.add('${ENVELOPE_OPENED}')`);
	});
});
