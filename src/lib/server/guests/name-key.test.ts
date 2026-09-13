import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nameKey } from './name-key';

const letter = fc.constantFrom(...'абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz');
const token = fc.string({ unit: letter, minLength: 1, maxLength: 12 });
const tokens = fc.array(token, { minLength: 1, maxLength: 4 });
const gap = fc.string({ unit: fc.constantFrom(' ', '\t', '\n'), minLength: 1, maxLength: 3 });
const noise = fc.string({ unit: fc.constantFrom('.', ',', '-', '!', '1', '"', "'"), maxLength: 3 });

describe('nameKey', () => {
	it('follows the spec steps on a known name', () => {
		expect(nameKey('  Петров-Водкин,  ЁЛКИН  артём ')).toBe('артем елкин петровводкин');
	});

	it('is order independent for the example from the spec', () => {
		expect(nameKey('Иван Петров')).toBe(nameKey('Петров Иван'));
	});

	it('is idempotent on arbitrary input', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'grapheme' }), (s) => {
				expect(nameKey(nameKey(s))).toBe(nameKey(s));
			})
		);
	});

	it('ignores token order', () => {
		fc.assert(
			fc.property(
				tokens.chain((ts) =>
					fc.tuple(
						fc.constant(ts),
						fc.shuffledSubarray(ts, { minLength: ts.length, maxLength: ts.length })
					)
				),
				([ts, shuffled]) => {
					expect(nameKey(shuffled.join(' '))).toBe(nameKey(ts.join(' ')));
				}
			)
		);
	});

	it('ignores case, extra whitespace and punctuation', () => {
		fc.assert(
			fc.property(
				tokens,
				fc.array(gap, { minLength: 3, maxLength: 3 }),
				noise,
				(ts, gaps, junk) => {
					const plain = ts.join(' ');
					const messy =
						gaps[0] +
						ts.map((t, i) => (i % 2 ? t.toUpperCase() : t) + junk).join(gaps[1]) +
						gaps[2];
					expect(nameKey(messy)).toBe(nameKey(plain));
				}
			)
		);
	});

	it('produces only lowercase letters separated by single spaces, sorted', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'grapheme' }), (s) => {
				const key = nameKey(s);
				expect(key).toMatch(/^(\p{L}+( \p{L}+)*)?$/u);
				expect(key).toBe(key.toLowerCase());
				expect(key).not.toMatch(/ё/);
				const parts = key === '' ? [] : key.split(' ');
				expect(parts).toEqual([...parts].sort());
			})
		);
	});
});
