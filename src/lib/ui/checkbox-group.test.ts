import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toggleValue } from './checkbox-group';

const id = fc.constantFrom<string>('a', 'b', 'c', 'd', 'e', 'f');
const values = fc.uniqueArray(id, { maxLength: 6 });
const max = fc.option(fc.integer({ min: 1, max: 6 }), { nil: undefined });

describe('toggleValue', () => {
	it('never duplicates a value', () => {
		fc.assert(
			fc.property(values, id, max, (vs, v, m) => {
				const next = toggleValue(vs, v, m);
				expect(new Set(next).size).toBe(next.length);
			})
		);
	});

	it('never exceeds max when the selection started within it', () => {
		fc.assert(
			fc.property(values, fc.array(id), fc.integer({ min: 1, max: 6 }), (start, clicks, m) => {
				let current = start.slice(0, m);
				for (const click of clicks) {
					current = toggleValue(current, click, m);
					expect(current.length).toBeLessThanOrEqual(m);
				}
			})
		);
	});

	it('changes only the clicked value', () => {
		fc.assert(
			fc.property(values, id, max, (vs, v, m) => {
				const next = toggleValue(vs, v, m);
				expect(next.filter((x) => x !== v)).toEqual(vs.filter((x) => x !== v));
			})
		);
	});

	it('always allows unchecking, and a second click undoes the first', () => {
		fc.assert(
			fc.property(values, id, max, (start, v, m) => {
				const vs = m === undefined ? start : start.slice(0, m);
				const once = toggleValue(vs, v, m);
				if (vs.includes(v)) expect(once).not.toContain(v);
				if (once.includes(v) !== vs.includes(v)) {
					expect(new Set(toggleValue(once, v, m))).toEqual(new Set(vs));
				}
			})
		);
	});
});
