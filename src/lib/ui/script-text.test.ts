import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { displayScript } from './script-text';

const CYRILLIC_A = 'А';
const LATIN_A = 'A';

describe('displayScript', () => {
	it('draws the Cyrillic capital A with the Latin capital glyph', () => {
		expect(displayScript('Алина')).toBe(`${LATIN_A}лина`);
		expect(displayScript('АЛИНА и Анна')).toBe('AЛИНA и Aнна');
	});

	it('leaves every other letter as written', () => {
		expect(displayScript('Кыз Узату! Семья Тулешовых')).toBe('Кыз Узату! Семья Тулешовых');
		expect(displayScript('алина а')).toBe('алина а');
	});

	it('changes nothing but the Cyrillic capital A, and keeps the length', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'binary', maxLength: 60 }), (text) => {
				const shown = displayScript(text);
				expect(shown).toHaveLength(text.length);
				[...text].forEach((char, index) => {
					expect([...shown][index]).toBe(char === CYRILLIC_A ? LATIN_A : char);
				});
			})
		);
	});

	it('is idempotent', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'binary', maxLength: 60 }), (text) => {
				expect(displayScript(displayScript(text))).toBe(displayScript(text));
			})
		);
	});
});
