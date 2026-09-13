import { animate } from 'motion/mini';
import type { Action } from 'svelte/action';

export type RevealOptions = { delay?: number; y?: number };

function token(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

type Bezier = [number, number, number, number];

// Reads motion tokens from app.css so JS animations match the CSS ones.
function motionTokens(): { duration: number; ease: Bezier } {
	const duration = Number.parseFloat(token('--dur-slow')) / 1000 || 0.7;
	const points = token('--ease-out')
		.match(/-?\d*\.?\d+/g)
		?.map(Number);
	const ease: Bezier = points?.length === 4 ? (points as Bezier) : [0.22, 1, 0.36, 1];
	return { duration, ease };
}

/**
 * Fades an element in when it scrolls into view. Content stays visible without JS: app.css hides
 * `[data-reveal]` only under `html.js`, and only when the user has not asked for reduced motion.
 */
export const reveal: Action<HTMLElement, RevealOptions | undefined> = (node, options = {}) => {
	// Tells the failsafe in app.html that JS is alive and will reveal the content itself.
	document.documentElement.dataset.revealReady = '';

	const done = () => {
		node.dataset.revealed = '';
	};

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduced || !('IntersectionObserver' in window)) {
		done();
		return;
	}

	const { delay = 0, y = 24 } = options;
	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			observer.disconnect();
			const { duration, ease } = motionTokens();
			const animation = animate(
				node,
				{ opacity: [0, 1], transform: [`translateY(${y}px)`, 'translateY(0)'] },
				{ duration, delay: delay / 1000, ease }
			);
			// Mark as revealed right away so the CSS guard never hides it again; the animation
			// already holds the starting frame.
			done();
			void animation.finished.catch(() => undefined);
		},
		{ rootMargin: '0px 0px -10% 0px' }
	);
	observer.observe(node);

	return { destroy: () => observer.disconnect() };
};
