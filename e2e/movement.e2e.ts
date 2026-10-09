import { expect, test } from '@playwright/test';
import { advance, openApp, snap, startMatch } from './helpers';

test.beforeEach(async ({ page }) => {
    await openApp(page);
    await startMatch(page);
});

test('sails forward at the configured speed', async ({ page }) => {
    const before = await snap(page);
    await page.keyboard.down('w');
    await advance(page, 1);
    await page.keyboard.up('w');
    const after = await snap(page);

    expect(after.player.x - before.player.x).toBeCloseTo(180, 0);
    expect(after.player.y).toBeCloseTo(before.player.y, 1);
});

test('turns left and right', async ({ page }) => {
    await page.keyboard.down('d');
    await advance(page, 0.2);
    await page.keyboard.up('d');
    expect((await snap(page)).player.angle).toBeCloseTo(0.5, 2);

    await page.keyboard.down('a');
    await advance(page, 0.4);
    await page.keyboard.up('a');
    expect((await snap(page)).player.angle).toBeCloseTo(-0.5, 2);
});

test('is stopped by the island', async ({ page }) => {
    await page.keyboard.down('w');
    await advance(page, 4);
    await page.keyboard.up('w');
    const { player } = await snap(page);

    expect(player.x).toBeGreaterThan(500);
    expect(player.x).toBeLessThanOrEqual(530.01);
    expect(player.y).toBeCloseTo(360, 1);
});

test('stays inside the arena', async ({ page }) => {
    await page.keyboard.down('a');
    await advance(page, 0.6);
    await page.keyboard.up('a');
    await page.keyboard.down('w');
    await advance(page, 4);
    await page.keyboard.up('w');

    const { player } = await snap(page);
    expect(player.y).toBeGreaterThanOrEqual(19.99);
    expect(player.y).toBeLessThan(25);
});

test('can sail and fire at the same time', async ({ page }) => {
    const before = await snap(page);
    await page.keyboard.down('w');
    await page.keyboard.down(' ');
    await advance(page, 0.5);
    await page.keyboard.up(' ');
    await page.keyboard.up('w');

    const after = await snap(page);
    expect(after.player.x).toBeGreaterThan(before.player.x + 80);
    expect(after.projectiles.some((p) => p.owner === 'player')).toBe(true);
});