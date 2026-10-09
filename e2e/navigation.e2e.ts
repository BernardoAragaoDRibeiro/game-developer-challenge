import { expect, test } from '@playwright/test';
import { advance, collectErrors, holdTouches, openApp, snap, startMatch } from './helpers';

test('abandoning a match registers nothing', async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    await advance(page, 1);

    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Quit to Main Menu' }).click();
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();

    await expect(page.getByRole('region', { name: 'Last match' })).toBeHidden();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText('You have not finished any match yet.')).toBeVisible();
});

test('reloading in the middle of a match goes back to the menu without a result', async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    await advance(page, 1);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last match' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Pending matches' })).toBeHidden();
});

test('repeated navigation leaves a single canvas and a clean console', async ({ page }) => {
    const errors = collectErrors(page);
    await openApp(page);

    for (let round = 0; round < 4; round++) {
        await startMatch(page);
        await expect(page.locator('canvas')).toHaveCount(1);
        await page.getByRole('button', { name: 'Pause' }).click();
        await page.getByRole('button', { name: 'Quit to Main Menu' }).click();
        await expect(page.locator('canvas')).toHaveCount(0);

        await page.getByRole('button', { name: 'Options' }).click();
        await page.getByRole('button', { name: 'Back' }).click();
    }
    expect(errors).toEqual([]);
});

test.describe('touch controls', () => {
    test.skip(({ isMobile }) => !isMobile, 'on-screen controls only exist on touch devices');

    test('are fully visible and can be held together', async ({ page }) => {
        await openApp(page);
        await startMatch(page);

        const labels = ['Turn left', 'Sail forward', 'Turn right', 'Fire left broadside', 'Fire front cannon', 'Fire right broadside'];
        const viewport = page.viewportSize()!;
        for (const label of labels) {
            const button = page.getByRole('button', { name: label });
            await expect(button).toBeVisible();
            const box = (await button.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        }

        const before = await snap(page);
        const release = await holdTouches(page, [
            page.getByRole('button', { name: 'Sail forward' }),
            page.getByRole('button', { name: 'Fire front cannon' }),
        ]);
        await advance(page, 0.5);
        await release();

        const after = await snap(page);
        expect(after.player.x).toBeGreaterThan(before.player.x + 50);
        expect(after.projectiles.some((p) => p.owner === 'player')).toBe(true);

        const stopped = await snap(page);
        await advance(page, 0.5);
        expect((await snap(page)).player.x).toBeCloseTo(stopped.player.x, 1);
    });
});