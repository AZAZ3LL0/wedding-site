import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseContent } from '$lib/content/schema';
import { content } from '$lib/content/wedding';
import { getContent } from './content';

describe('getContent', () => {
	it('returns the parsed wedding.ts and parses it only once', () => {
		expect(getContent()).toEqual(parseContent(content));
		expect(getContent()).toBe(getContent());
	});
});

// Stage 6 is not done while a placeholder is left (tech.md §7, 6.1).
describe('wedding.ts', () => {
	it('carries no placeholder in values or comments', () => {
		const source = readFileSync('src/lib/content/wedding.ts', 'utf8');
		expect(source).not.toMatch(/todo/i);
		expect(JSON.stringify(content)).not.toMatch(/todo/i);
	});
});
