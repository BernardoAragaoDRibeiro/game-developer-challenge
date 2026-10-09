import { expect, test } from '@playwright/test';
import { advance, advanceAndSnap, NO_ISLAND, openApp, SHORT_SETTINGS, snap, startMatch, SURVIVOR } from './helpers';

test('a match ends by time, freezes, and shows the result', async ({ page }) => {
    await openApp(page, { settings: SHORT_SETTINGS, config: SURVIVOR });
    await startMatch(page);

    await page.keyboard.down('w');
    await page.keyboard.down(' ');
    const { ended, after } = await page.evaluate(() => {
        const game = window.__pirate!;
        game.advance(61);
        const ended = game.snapshot();
        game.advance(5);
        return { ended, after: game.snapshot() };
    });
    await page.keyboard.up(' ');
    await page.keyboard.up('w');

    expect(ended.status).toBe('ended');
    expect(ended.endReason).toBe('time');
    expect(ended.time).toBe(60);
    expect(after).toEqual(ended);

    await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
    await expect(page.getByText('Time ran out', { exact: true })).toBeVisible();
});

test('a match ends by death', async ({ page }) => {
    await openApp(page, { config: { player: { maxHealth: 25 }, ...NO_ISLAND } });
    await startMatch(page);

    let s = await snap(page);
    for (let i = 0; i < 240 && s.status === 'playing'; i++) {
        s = await advanceAndSnap(page, 0.5);
    }
    expect(s.status).toBe('ended');
    expect(s.endReason).toBe('death');
    expect(s.player.health).toBe(0);

    await expect(page.getByRole('heading', { name: 'Game Over' })).toBeVisible();
    await expect(page.getByText('Your ship was destroyed')).toBeVisible();
});

test('Play Again starts a clean match', async ({ page }) => {
    await openApp(page, { settings: SHORT_SETTINGS, config: SURVIVOR });
    await startMatch(page);
    await page.keyboard.down('w');
    await advance(page, 61);
    await page.keyboard.up('w');
    await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();

    await page.getByRole('button', { name: 'Play Again' }).click();
    await page.waitForFunction(() => window.__pirate !== undefined);

    const s = await snap(page);
    expect(s.status).toBe('playing');
    expect(s.time).toBe(0);
    expect(s.score).toBe(0);
    expect(s.spawned).toBe(0);
    expect(s.enemies).toEqual([]);
    expect(s.projectiles).toEqual([]);
    expect(s.player.x).toBe(200);
    expect(s.player.health).toBe(1_000_000);
    await expect(page.getByText('Score:')).toContainText('0');
    await expect(page.getByText('Time:')).toContainText('60s');
});

test('the result is shown, then kept in the menu after a reload', async ({ page }) => {
    await openApp(page, { settings: SHORT_SETTINGS, config: SURVIVOR });
    await startMatch(page);
    await advance(page, 61);

    await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
    await expect(page.getByText('Score', { exact: true })).toBeVisible();
    await expect(page.getByText('60.0s')).toBeVisible();

    await page.getByRole('button', { name: 'Main Menu' }).click();
    const last = page.getByRole('region', { name: 'Last match' });
    await expect(last).toContainText('0 points in 60.0s');
    await expect(last).toContainText('time ran out');

    await page.reload();
    await expect(page.getByRole('region', { name: 'Last match' })).toContainText('0 points in 60.0s');
});

test.describe('pause', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await startMatch(page);
    });

    test('freezes the match and the clock, and resuming does not jump', async ({ page }) => {
        await advance(page, 1);
        await page.getByRole('button', { name: 'Pause' }).click();
        const dialog = page.getByRole('dialog', { name: 'Paused' });
        await expect(dialog).toBeVisible();

        const frozen = await snap(page);
        expect(frozen.paused).toBe(true);
        await advance(page, 5);
        expect(await snap(page)).toEqual(frozen);

        await page.getByRole('button', { name: 'Resume' }).click();
        await expect(dialog).toBeHidden();
        await advance(page, 1);
        const resumed = await snap(page);
        expect(resumed.time).toBeCloseTo(frozen.time + 1, 1);
        expect(resumed.paused).toBe(false);
    });

    test('P and Esc toggle the pause', async ({ page }) => {
        await page.keyboard.press('p');
        await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();
    });

    test('losing focus or hiding the tab pauses automatically', async ({ page }) => {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
        await page.getByRole('button', { name: 'Resume' }).click();

        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    });

    test('resuming does not replay movement held during the pause', async ({ page }) => {
        await page.keyboard.down('w');
        await advance(page, 0.5);
        await page.keyboard.press('p');
        await page.keyboard.up('w');
        const atPause = await snap(page);

        await page.getByRole('button', { name: 'Resume' }).click();
        await advance(page, 1);
        expect((await snap(page)).player.x).toBeCloseTo(atPause.player.x, 1);
    });

    test('keeps keyboard focus inside the dialog and returns it on resume', async ({ page }) => {
        await page.getByRole('button', { name: 'Pause' }).click();
        await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Quit to Main Menu' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();

        await page.keyboard.press('Space');
        await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();
        await expect(page.getByRole('button', { name: 'Pause' })).toBeFocused();
    });
});