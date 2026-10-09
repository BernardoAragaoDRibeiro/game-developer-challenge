import { expect, test } from '@playwright/test';
import { advance, openApp, SHORT_SETTINGS, startMatch, SURVIVOR } from './helpers';

test('main menu matches baseline', async ({ page }) => {
    await openApp(page, { net: { scenario: 'success', latencyMs: 20 } });
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Ranking' })).toBeVisible();
    await expect(page).toHaveScreenshot('main-menu.png');
});

test('arena in a stable state matches baseline', async ({ page }) => {
    await openApp(page, { settings: SHORT_SETTINGS, config: SURVIVOR });
    await startMatch(page);
    await advance(page, 5);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page).toHaveScreenshot('arena.png');
});

test('result screen matches baseline', async ({ page }) => {
    await openApp(page, { settings: SHORT_SETTINGS, config: SURVIVOR, net: { latencyMs: 20 } });
    await startMatch(page);
    await advance(page, 61);
    await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
    await expect(page).toHaveScreenshot('result.png');
});
