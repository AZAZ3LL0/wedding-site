import { expect, test } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';

// A messenger fetches the shared link with no cookies and no JavaScript, like this request.
test('the shared link carries a preview card for messengers', async ({ request, baseURL }) => {
	const response = await request.get('/', { headers: { accept: 'text/html' } });
	expect(response.status()).toBe(200);
	const html = await response.text();
	const meta = (property: string) =>
		new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`).exec(html)?.[1];

	expect(meta('og:title')).toBe(content.entry.eyebrow);
	expect(meta('og:description')).toBe(content.cover.text);
	expect(meta('twitter:card')).toBe('summary_large_image');

	const image = meta('og:image');
	expect(image).toBe(new URL(content.cover.photo.src, baseURL).href);
	const picture = await request.get(image!);
	expect(picture.status()).toBe(200);
	expect(picture.headers()['content-type']).toMatch(/^image\/(jpeg|png)$/);
});
