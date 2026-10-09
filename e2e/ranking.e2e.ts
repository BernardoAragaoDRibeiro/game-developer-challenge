import { expect, test } from '@playwright/test';
import { advance, NET_KEY, openApp, SHORT_SETTINGS, startMatch, SURVIVOR } from './helpers';

// ---------------------------------------------------------------------------
// Test 10 — Ranking and Match History tabs: query, pagination, loading, empty, error
// ---------------------------------------------------------------------------

test.describe('Ranking tab', () => {
    test('shows fixture entries and paginates', async ({ page }) => {
        await openApp(page, { net: { scenario: 'success', latencyMs: 20 } });

        await page.getByRole('tab', { name: 'Ranking' }).click();
        // Default scenario has 34 fixtures → 4 pages of 10
        await expect(page.getByRole('table', { name: 'Ranking' })).toBeVisible();
        const rows = page.getByRole('row');
        // 10 data rows + 1 header
        await expect(rows).toHaveCount(11);

        const prevBtn = page.getByRole('button', { name: 'Previous' });
        const nextBtn = page.getByRole('button', { name: 'Next' });
        await expect(prevBtn).toBeDisabled();
        await expect(nextBtn).toBeEnabled();

        await nextBtn.click();
        await expect(page.getByText('Page 2 of')).toBeVisible();
        await expect(prevBtn).toBeEnabled();
    });

    test('shows empty state when no matches exist for the current config', async ({ page }) => {
        await openApp(page, { net: { scenario: 'empty', latencyMs: 20 } });
        await page.getByRole('tab', { name: 'Ranking' }).click();
        await expect(page.getByText('No matches with this configuration yet.')).toBeVisible();
    });

    test('shows an error and a retry button when the ranking fails', async ({ page }) => {
        await openApp(page, { net: { scenario: 'ranking-fails', latencyMs: 20 } });
        await page.getByRole('tab', { name: 'Ranking' }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    });

    test('loading state is shown while ranking is fetching', async ({ page }) => {
        await openApp(page, { net: { scenario: 'slow', latencyMs: 100 } });
        await page.getByRole('tab', { name: 'Ranking' }).click();
        await expect(page.locator('[role="status"][aria-busy="true"]')).toBeVisible();
        await expect(page.getByRole('table', { name: 'Ranking' })).toBeVisible();
    });
});

test.describe('Match History tab', () => {
    test('shows empty state before the first finished match', async ({ page }) => {
        await openApp(page, { net: { scenario: 'success', latencyMs: 20 } });
        await page.getByRole('tab', { name: 'Match History' }).click();
        await expect(page.getByText('You have not finished any match yet.')).toBeVisible();
    });

    test('shows an error and a retry button when history fails', async ({ page }) => {
        await openApp(page, { net: { scenario: 'history-fails', latencyMs: 20 } });
        await page.getByRole('tab', { name: 'Match History' }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// Test 11 — Match registration: both tabs update, pending record survives refresh
// ---------------------------------------------------------------------------

test('finishing a match registers it and updates both tabs', async ({ page }) => {
    await openApp(page, { settings: SHORT_SETTINGS, config: SURVIVOR, net: { latencyMs: 20 } });
    await startMatch(page);
    await advance(page, 61);

    await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/Registering|registered/i);

    // Wait for registration to complete
    await expect(page.getByRole('status')).toContainText('registered', { timeout: 8000 });

    await page.getByRole('button', { name: 'Main Menu' }).click();

    // History tab should now have 1 entry
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByRole('table', { name: 'Match history' })).toBeVisible();

    // Ranking tab should also reflect the new entry
    await page.getByRole('tab', { name: 'Ranking' }).click();
    await expect(page.getByRole('table', { name: 'Ranking' })).toBeVisible();
    await expect(page.getByText('(you)')).toBeVisible();
});

test('a pending registration survives a page refresh and is retried', async ({ page }) => {
    await openApp(page, { settings: SHORT_SETTINGS, config: SURVIVOR, net: { scenario: 'register-unavailable', latencyMs: 20 } });
    await startMatch(page);
    await advance(page, 61);

    await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Could not register');

    await page.getByRole('button', { name: 'Main Menu' }).click();
    await expect(page.getByRole('region', { name: 'Pending matches' })).toBeVisible();

    // Reload: pending record must survive (sessionStorage guard keeps net settings, pending stays in localStorage)
    await page.reload();
    await expect(page.getByRole('region', { name: 'Pending matches' })).toBeVisible();

    // Switch to success scenario without navigating (sessionStorage guard would block addInitScript)
    await page.evaluate(
        ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
        [NET_KEY, { scenario: 'success', latencyMs: 20 }] as const,
    );
    await page.reload();

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('region', { name: 'Pending matches' })).toBeHidden({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 12 — No duplication on retry after timeout; stale responses don't overwrite
// ---------------------------------------------------------------------------

test('retrying after a register timeout does not duplicate the entry', async ({ page }) => {
    // timeoutMs:2000 — long enough for the result screen to appear, short enough to fire before registration succeeds
    await openApp(page, {
        settings: SHORT_SETTINGS,
        config: SURVIVOR,
        net: { scenario: 'register-timeout-after-commit', latencyMs: 20, timeoutMs: 2000 },
    });
    await startMatch(page);
    await advance(page, 61);

    await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Could not register', { timeout: 8000 });

    // Switch to success scenario and retry
    await page.evaluate(
        ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
        [NET_KEY, { scenario: 'success', latencyMs: 20 }] as const,
    );

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('status')).toContainText('registered', { timeout: 8000 });

    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByRole('table', { name: 'Match history' })).toBeVisible();

    // Should be exactly 1 row despite the retry
    const rows = page.getByRole('row');
    await expect(rows).toHaveCount(2); // 1 header + 1 data row
});

test('an out-of-order response does not overwrite newer data', async ({ page }) => {
    await openApp(page, { net: { scenario: 'out-of-order', latencyMs: 40 } });

    await page.getByRole('tab', { name: 'Ranking' }).click();
    // Wait for the first response (fast one) to arrive
    await expect(page.getByRole('table', { name: 'Ranking' })).toBeVisible();

    // Navigate to page 2 (triggers a slow request) then immediately back to page 1 (fast)
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Previous' }).click();

    // Should be back on page 1 without the stale page-2 data overwriting it
    await expect(page.getByText('Page 1 of')).toBeVisible();
    const rows = page.getByRole('row');
    await expect(rows).toHaveCount(11); // 10 data rows + 1 header (page 1 size)
});
