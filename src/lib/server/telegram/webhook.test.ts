import { describe, expect, it } from 'vitest';
import { secretMatches } from './webhook';

describe('secretMatches', () => {
	it('accepts the configured secret', () => {
		expect(secretMatches('s3cret-header-value', 's3cret-header-value')).toBe(true);
	});

	it('rejects a different secret of the same length', () => {
		expect(secretMatches('s3cret-header-value', 's3cret-header-valuf')).toBe(false);
	});

	it('rejects a prefix of the secret instead of throwing on the length', () => {
		expect(secretMatches('s3cret-header-value', 's3cret')).toBe(false);
	});

	it.each([
		['no secret is configured', null, 'anything'],
		['no header arrives', 'configured', null],
		['neither side has one', null, null],
		['the header is empty', 'configured', ''],
		['the configured secret is empty', '', 'configured']
	])('rejects the request when %s', (_, expected, received) => {
		expect(secretMatches(expected, received)).toBe(false);
	});
});
