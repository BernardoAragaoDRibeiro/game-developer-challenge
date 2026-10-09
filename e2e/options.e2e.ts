import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('options validate input, save, and persist after a reload', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();

    const time = page.getByLabel('Game session time (seconds)');
    const spawn = page.getByLabel('Enemy spawn time (seconds)');
    const save = page.getByRole('button', { name: 'Save' });
    const timeError = 'Enter a whole number of seconds between 60 and 180.';
    const spawnError = 'Enter a number of seconds between 1 and 10.';

    for (const bad of ['59', '181', '90.5', '']) {
        await time.fill(bad);
        await expect(page.getByText(timeError)).toBeVisible();
        await expect(save).toBeDisabled();
    }
    await time.fill('120');
    await expect(page.getByText(timeError)).toBeHidden();

    for (const bad of ['0', '11', '']) {
        await spawn.fill(bad);
        await expect(page.getByText(spawnError)).toBeVisible();
        await expect(save).toBeDisabled();
    }
    await spawn.fill('2.5');
    await expect(save).toBeEnabled();

    await save.click();
    await expect(page.getByText('Settings saved.')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(time).toHaveValue('120');
    await expect(spawn).toHaveValue('2.5');
});

test('invalid values are never saved', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Options' }).click();
    await page.getByLabel('Game session time (seconds)').fill('10');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.getByRole('button', { name: 'Back' }).click();

    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByLabel('Game session time (seconds)')).toHaveValue('90');
});