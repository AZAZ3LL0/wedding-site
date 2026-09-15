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
