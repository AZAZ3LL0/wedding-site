import { expect, test } from '@playwright/test';
import { content } from '../../src/lib/content/wedding';
import { seedGuests, seedParties } from '../../scripts/seed';
import { signIn } from './guest';

const { byAudience, sections } = content;

// One seed guest per audience; the family one is invited to the registry, the rest are not.
const cases = (['family', 'friends', 'colleagues'] as const).map((audience) => {
	const party = seedParties.find(
		(p) => p.audience === audience && seedGuests.some((g) => g.partyId === p.id && !g.isPlusOne)
	)!;
	const guest = seedGuests.find((g) => g.partyId === party.id && !g.isPlusOne)!;
	return { audience, party, guest };
});

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => sessionStorage.setItem('envelope-opened', '1'));
});

for (const { audience, party, guest } of cases) {
	test(`${audience}: greets the guest and follows the registry rules`, async ({
		page,
		context,
		baseURL
	}) => {
		const name = `${guest.firstName} ${guest.lastName}`;
		const namesakes = seedGuests.filter(
			(g) => g.nameKey === guest.nameKey && g.partyId !== party.id
		);
		await signIn(context, baseURL!, name, namesakes.length > 0 ? guest.id : undefined);

		const response = await page.goto('/i');
		const welcome = page.locator('[data-welcome]');
		await welcome.scrollIntoViewIfNeeded();
		await expect(welcome).toContainText(byAudience[audience].greeting);
		await expect(welcome).toContainText(guest.displayName);

		// registry is null in wedding.ts, so no audience sees it, invited or not.
		const location = page.getByRole('region', { name: sections.location.title });
		await location.scrollIntoViewIfNeeded();
		await expect(location.locator('[data-place="venue"]')).toBeVisible();
		await expect(location.locator('[data-place="registry"]')).toHaveCount(0);
		await expect(page.getByText(sections.location.registryCeremony)).toHaveCount(0);

		// Not rendered is not enough: the page payload carries no registry either.
		const html = (await response!.text()) + (await page.content());
		expect(html).not.toMatch(/registry:\s*\{/);
		expect(party.invitedToRegistry).toBe(audience === 'family');
	});
}
