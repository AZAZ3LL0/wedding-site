// Path data for the card ornaments, computed once per render so the SVG ships in the SSR markup.

const fixed = (n: number) => Number(n.toFixed(2));

// An ellipse traced by `scallops` outward bumps: the edge of a wax seal or a lace date plate.
export function scallopedEllipse(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	scallops: number,
	bump: number
): string {
	const points = Array.from({ length: scallops + 1 }, (_, i) => {
		const t = (i / scallops) * Math.PI * 2;
		return [fixed(cx + rx * Math.cos(t)), fixed(cy + ry * Math.sin(t))] as const;
	});
	const [[x0, y0], ...rest] = points as [
		readonly [number, number],
		...(readonly [number, number])[]
	];
	return `M${x0} ${y0}${rest.map(([x, y]) => ` A${bump} ${bump} 0 0 1 ${x} ${y}`).join('')}Z`;
}
