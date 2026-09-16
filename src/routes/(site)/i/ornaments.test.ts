import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { scallopedEllipse } from './ornaments';

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('scallopedEllipse', () => {
	it('draws one arc per scallop and closes where it started', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 3, max: 64 }),
				fc.integer({ min: 10, max: 500 }),
				fc.integer({ min: 10, max: 500 }),
				(scallops, rx, ry) => {
					const path = scallopedEllipse(0, 0, rx, ry, scallops, 5);
					expect(path.match(/A/g)).toHaveLength(scallops);
					expect(path.endsWith('Z')).toBe(true);
					const all = numbers(path);
					expect(all.slice(-2)).toEqual(all.slice(0, 2));
				}
			)
		);
	});

	it('keeps every point on the ellipse', () => {
		fc.assert(
			fc.property(fc.integer({ min: 3, max: 40 }), fc.integer({ min: 20, max: 300 }), (n, rx) => {
				const ry = rx * 0.6;
				const path = scallopedEllipse(100, 50, rx, ry, n, 4);
				for (const [, x, y] of path.matchAll(/(?:M|0 0 1 )(-?[\d.]+) (-?[\d.]+)/g)) {
					const d = ((Number(x) - 100) / rx) ** 2 + ((Number(y) - 50) / ry) ** 2;
					expect(d).toBeCloseTo(1, 1);
				}
			})
		);
	});
});
