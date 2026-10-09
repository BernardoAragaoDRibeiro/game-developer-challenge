import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { openApp, startMatch } from './helpers';

const MATCH_DURATION = 180;
const CYCLES = 5;
const REPORT_PATH = 'perf-report.json';

test.describe.configure({ mode: 'serial' });

test('frame-time profile over a 3-minute match', async ({ page, browserName }) => {
    test.setTimeout(300_000);

    await openApp(page, {
        settings: { sessionTime: MATCH_DURATION, spawnInterval: 3 },
        net: { latencyMs: 20 },
    });
    await startMatch(page);

    const frameTimes: number[] = await page.evaluate((duration) => {
        return new Promise<number[]>((resolve) => {
            const times: number[] = [];
            let last = performance.now();
            let elapsed = 0;

            function tick() {
                const now = performance.now();
                const dt = now - last;
                times.push(dt);
                elapsed += dt;
                last = now;
                if (elapsed < duration * 1000) requestAnimationFrame(tick);
                else resolve(times);
            }
            requestAnimationFrame(tick);
        });
    }, MATCH_DURATION);

    const snap = await page.evaluate(() => window.__pirate!.snapshot());

    frameTimes.sort((a, b) => a - b);
    const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)]!;
    const avgFps = 1000 / (frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length);
    const minFps = 1000 / frameTimes[frameTimes.length - 1]!;

    const entityCount = snap.enemies.length + snap.projectiles.length + 1;

    const report = {
        timestamp: new Date().toISOString(),
        environment: {
            browser: browserName,
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
            viewport: '1280x800',
        },
        matchConfig: { sessionTime: MATCH_DURATION, spawnInterval: 3 },
        results: {
            totalFrames: frameTimes.length,
            avgFps: Math.round(avgFps * 10) / 10,
            minFps: Math.round(minFps * 10) / 10,
            p95FrameTimeMs: Math.round(p95 * 100) / 100,
            entityCountAtEnd: entityCount,
        },
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log('\n--- Performance report ---');
    console.log(`  avg FPS : ${report.results.avgFps}`);
    console.log(`  min FPS : ${report.results.minFps}`);
    console.log(`  p95 dt  : ${report.results.p95FrameTimeMs} ms`);
    console.log(`  entities: ${entityCount}`);
    console.log(`  report  : ${REPORT_PATH}\n`);

    expect(p95).toBeLessThan(50);
    expect(avgFps).toBeGreaterThan(30);
});

test('memory does not grow continuously across 5 play cycles', async ({ page, browserName }) => {
    test.setTimeout(180_000);

    const heapSnapshots: number[] = [];

    for (let cycle = 0; cycle < CYCLES; cycle++) {
        await openApp(page, {
            settings: { sessionTime: 10, spawnInterval: 2 },
            net: { latencyMs: 20 },
        });
        await startMatch(page);

        await page.waitForTimeout(10_000);

        await page.getByRole('button', { name: 'Pause' }).click();
        await page.getByRole('button', { name: 'Quit to Main Menu' }).click();
        await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();

        const heap: number = await page.evaluate(
            () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
        );
        heapSnapshots.push(heap);
    }

    const existingReport = fs.existsSync(REPORT_PATH)
        ? (JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as Record<string, unknown>)
        : {};

    const memReport = {
        browser: browserName,
        heapPerCycleMb: heapSnapshots.map((h) => Math.round(h / 1024 / 1024)),
        growthFromFirstToLastMb:
            Math.round((heapSnapshots[CYCLES - 1]! - heapSnapshots[0]!) / 1024 / 1024),
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify({ ...existingReport, memory: memReport }, null, 2));

    console.log('\n--- Memory report ---');
    console.log(`  heap per cycle (MB): ${memReport.heapPerCycleMb.join(', ')}`);
    console.log(`  growth first→last  : ${memReport.growthFromFirstToLastMb} MB\n`);

    const first = heapSnapshots[0]!;
    const last = heapSnapshots[CYCLES - 1]!;
    expect(last).toBeLessThan(first * 2.5);
});
