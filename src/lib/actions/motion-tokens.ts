export type Bezier = [number, number, number, number];

function token(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Reads motion tokens from app.css so JS animations match the CSS ones. Duration in seconds.
export function motionTokens(): { duration: number; ease: Bezier } {
	const duration = Number.parseFloat(token('--dur-slow')) / 1000 || 0.7;
	const points = token('--ease-out')
		.match(/-?\d*\.?\d+/g)
		?.map(Number);
	const ease: Bezier = points?.length === 4 ? (points as Bezier) : [0.22, 1, 0.36, 1];
	return { duration, ease };
}
