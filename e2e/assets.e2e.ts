import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

interface AtlasControl {
    fail: boolean;
    delayMs: number;
}

// page.route() cannot see requests answered by MSW's service worker, so the atlas
// request is controlled from inside the page instead.
async function controlAtlasFetch(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const realFetch = window.fetch.bind(window);
        const control: AtlasControl = { fail: false, delayMs: 0 };
        Object.assign(window, { __atlas: control });
        window.fetch = async (input, init) => {
            const url = input instanceof Request ? input.url : String(input);
            if (url.includes('ships_miscellaneous_sheet.xml')) {
                if (control.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, control.delayMs));
                if (control.fail) throw new TypeError('Failed to fetch');
            }
            return realFetch(input, init);
        };
    });
}

const setAtlas = (page: Page, patch: Partial<AtlasControl>) =>
    page.evaluate((p) => Object.assign((window as unknown as { __atlas: AtlasControl }).__atlas, p), patch);

test('shows a loading state while the assets load', async ({ page }) => {
    await controlAtlasFetch(page);
    await openApp(page);
    await setAtlas(page, { delayMs: 800 });
    await page.getByRole('button', { name: 'Play' }).click();

    await expect(page.getByText('Loading assets…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeEnabled();
    await expect(page.getByText('Loading assets…')).toBeHidden();
});

test('an asset failure shows an error and "Try again" recovers', async ({ page }) => {
    await controlAtlasFetch(page);
    await openApp(page);
    await setAtlas(page, { fail: true });
    await page.getByRole('button', { name: 'Play' }).click();

    await expect(page.getByRole('alert')).toContainText('Could not load the game assets.');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeDisabled();

    await setAtlas(page, { fail: false });
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeEnabled();
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('alert')).toBeHidden();
});