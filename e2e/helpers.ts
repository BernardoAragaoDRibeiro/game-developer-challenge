import { expect, type Locator, type Page } from '@playwright/test';
import type { TestSnapshot } from '../src/testing/e2e';

export const SETTINGS_KEY = 'pirate-battle:settings';
export const NET_KEY = 'pirate-battle:net-settings';

interface OpenOptions {
    seed?: number;
    config?: Record<string, unknown>;
    settings?: { sessionTime: number; spawnInterval: number };
    net?: Record<string, unknown>;
}

export async function openApp(page: Page, o: OpenOptions = {}): Promise<void> {
    const seed: Record<string, unknown> = { [NET_KEY]: { latencyMs: 20, timeoutMs: 1500, ...o.net } };
    if (o.settings) seed[SETTINGS_KEY] = o.settings;
    // sessionStorage guard: seed once per tab, so a reload keeps what the app saved
    await page.addInitScript((data) => {
        if (sessionStorage.getItem('__e2e_seeded')) return;
        sessionStorage.setItem('__e2e_seeded', '1');
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
    }, seed);

    const qs = new URLSearchParams({ e2e: '1', seed: String(o.seed ?? 1) });
    if (o.config) qs.set('config', JSON.stringify(o.config));
    await page.goto(`/?${qs.toString()}`);
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
}

export async function startMatch(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Play' }).click();
    await page.waitForFunction(() => window.__pirate !== undefined);
}

export const snap = (page: Page): Promise<TestSnapshot> =>
    page.evaluate(() => window.__pirate!.snapshot());

export const advance = (page: Page, seconds: number): Promise<void> =>
    page.evaluate((s) => window.__pirate!.advance(s), seconds);

// One round trip. Needed around the end of a match: the test API disappears when the
// Result screen replaces the match, so advance and snapshot must happen together.
export const advanceAndSnap = (page: Page, seconds: number): Promise<TestSnapshot> =>
    page.evaluate((s) => {
        window.__pirate!.advance(s);
        return window.__pirate!.snapshot();
    }, seconds);

export const STEP = 1 / 60;

export class Keys {
    private held = new Set<string>();
    private readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async set(key: string, down: boolean): Promise<void> {
        if (down && !this.held.has(key)) {
            this.held.add(key);
            await this.page.keyboard.down(key);
        } else if (!down && this.held.has(key)) {
            this.held.delete(key);
            await this.page.keyboard.up(key);
        }
    }

    async releaseAll(): Promise<void> {
        for (const key of [...this.held]) await this.set(key, false);
    }
}

export const normalizeAngle = (a: number): number => {
    let x = a;
    while (x > Math.PI) x -= 2 * Math.PI;
    while (x < -Math.PI) x += 2 * Math.PI;
    return x;
};

export const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    return errors;
}

export async function holdTouches(page: Page, targets: Locator[]): Promise<() => Promise<void>> {
    const cdp = await page.context().newCDPSession(page);
    const touchPoints = [];
    for (const [i, target] of targets.entries()) {
        const box = (await target.boundingBox())!;
        touchPoints.push({ x: box.x + box.width / 2, y: box.y + box.height / 2, id: i + 1 });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
    return async () => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    };
}

export const SURVIVOR = { player: { maxHealth: 1_000_000 } };
// Without the island, enemies and shots move in straight lines
export const NO_ISLAND = { islands: [] };
export const SHORT_SETTINGS = { sessionTime: 60, spawnInterval: 3 };