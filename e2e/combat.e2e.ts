import { expect, test, type Page } from '@playwright/test';
import {
    advance, advanceAndSnap, distance, Keys, NO_ISLAND, normalizeAngle, openApp, snap, startMatch, STEP, SURVIVOR,
} from './helpers';

const playerShots = async (page: Page) =>
    (await snap(page)).projectiles.filter((p) => p.owner === 'player');

test.describe('weapons', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await startMatch(page);
    });

    test('the front cannon respects its cooldown', async ({ page }) => {
        await page.keyboard.down(' ');
        await advance(page, 0.5);
        await page.keyboard.up(' ');
        expect(await playerShots(page)).toHaveLength(2);
    });

    test('a broadside fires three parallel shots, then waits for its cooldown', async ({ page }) => {
        await page.keyboard.down('q');
        await advance(page, STEP);
        const volley = await playerShots(page);
        expect(volley).toHaveLength(3);
        for (const shot of volley) {
            expect(shot.vy).toBeLessThan(0);
            expect(shot.vy).toBeCloseTo(volley[0]!.vy, 3);
        }

        await advance(page, 1.1);
        expect(await playerShots(page)).toHaveLength(0);
        await advance(page, 0.2);
        expect(await playerShots(page)).toHaveLength(3);
        await page.keyboard.up('q');
    });

    test('the right broadside fires the other way', async ({ page }) => {
        await page.keyboard.down('e');
        await advance(page, STEP);
        await page.keyboard.up('e');
        const volley = await playerShots(page);
        expect(volley).toHaveLength(3);
        expect(volley.every((s) => s.vy > 0)).toBe(true);
    });

    test('shots are removed when they hit the island', async ({ page }) => {
        await page.keyboard.down(' ');
        await advance(page, STEP);
        await page.keyboard.up(' ');
        expect(await playerShots(page)).toHaveLength(1);
        await advance(page, 1);
        expect(await playerShots(page)).toHaveLength(0);
    });
});

test.describe('enemies', () => {
    test('spawns a Chaser first and a Shooter next, at the configured interval', async ({ page }) => {
        await openApp(page, { settings: { sessionTime: 90, spawnInterval: 2 } });
        await startMatch(page);

        await advance(page, 1.9);
        expect((await snap(page)).spawned).toBe(0);
        await advance(page, 0.2);
        let s = await snap(page);
        expect(s.spawned).toBe(1);
        expect(s.enemies.map((e) => e.kind)).toEqual(['chaser']);

        await advance(page, 2);
        s = await snap(page);
        expect(s.spawned).toBe(2);
        expect(s.enemies.map((e) => e.kind)).toEqual(['chaser', 'shooter']);
    });

    test('spawn points are away from the player and from the island', async ({ page }) => {
        await openApp(page, { seed: 5, settings: { sessionTime: 90, spawnInterval: 1 } });
        await startMatch(page);
        await advance(page, 1.1);
        const s = await snap(page);
        for (const e of s.enemies) {
            expect(distance(e, s.player)).toBeGreaterThanOrEqual(350);
            expect(distance(e, { x: 640, y: 360 })).toBeGreaterThan(110);
        }
    });

    test('a Chaser closes in on the player', async ({ page }) => {
        await openApp(page, { config: NO_ISLAND });
        await startMatch(page);
        await advance(page, 3.05);
        const first = await snap(page);
        const chaser = first.enemies[0]!;
        await advance(page, 1);
        const later = (await snap(page)).enemies.find((e) => e.id === chaser.id)!;
        expect(distance(later, first.player)).toBeLessThan(distance(chaser, first.player) - 100);
    });

    test('a Chaser that rams the player hurts it, explodes and does not score', async ({ page }) => {
        await openApp(page, { config: NO_ISLAND });
        await startMatch(page);
        await advance(page, 3.05);
        const chaserId = (await snap(page)).enemies[0]!.id;

        let s = await snap(page);
        for (let i = 0; i < 120 && s.enemies.some((e) => e.id === chaserId); i++) {
            s = await advanceAndSnap(page, 0.25);
        }
        expect(s.enemies.some((e) => e.id === chaserId)).toBe(false);
        expect(s.player.health).toBeLessThanOrEqual(75);
        expect(s.score).toBe(0);
    });

    test('a Shooter only fires once the player is within its attack range', async ({ page }) => {
        await openApp(page, { config: { ...SURVIVOR, ...NO_ISLAND } });
        await startMatch(page);

        let s = await snap(page);
        for (let i = 0; i < 200 && !s.projectiles.some((p) => p.owner === 'enemy'); i++) {
            s = await advanceAndSnap(page, 0.25);
        }
        const shooter = s.enemies.find((e) => e.kind === 'shooter');
        expect(shooter).toBeDefined();
        expect(s.projectiles.some((p) => p.owner === 'enemy')).toBe(true);
        expect(distance(shooter!, s.player)).toBeLessThanOrEqual(330);
    });
});

// Bot: turns towards the nearest enemy with the real keys and fires the front cannon
test('a player shot damages an enemy once, and destroying it scores exactly 1 point', async ({ page }) => {
    await openApp(page, { seed: 3, config: { ...SURVIVOR, ...NO_ISLAND } });
    await startMatch(page);
    const keys = new Keys(page);
    let firstDamage: number | null = null;

    let s = await snap(page);
    for (let i = 0; i < 2400 && s.score < 1 && s.status === 'playing'; i++) {
        const target = [...s.enemies].sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
        for (const e of s.enemies) {
            const max = e.kind === 'chaser' ? 20 : 30;
            if (firstDamage === null && e.health < max) firstDamage = max - e.health;
        }
        if (!target) {
            s = await advanceAndSnap(page, 0.1);
        } else {
            const diff = normalizeAngle(Math.atan2(target.y - s.player.y, target.x - s.player.x) - s.player.angle);
            await keys.set('a', diff < -0.03);
            await keys.set('d', diff > 0.03);
            await keys.set(' ', Math.abs(diff) < 0.07);
            s = await advanceAndSnap(page, Math.abs(diff) < 0.07 ? 3 * STEP : STEP);
        }
    }
    await keys.releaseAll();

    expect(s.score).toBe(1);
    expect(firstDamage).toBe(10);

    await advance(page, 2);
    expect((await snap(page)).score).toBe(1);
});