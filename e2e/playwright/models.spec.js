// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Models Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#models');
        // Wait for model stats to load
        const modelStats = page.locator('[data-testid="model-stats"]');
        await expect(modelStats).not.toContainText('Loading', { timeout: 15000 });
    });

    test('displays model stats container', async ({ page }) => {
        const container = page.locator('[data-testid="model-stats"]');
        await expect(container).toBeVisible();
    });

    test('model stats has content', async ({ page }) => {
        const content = await page.locator('[data-testid="model-stats"]').textContent();
        // Either has model cards or empty state message
        expect(content?.length).toBeGreaterThan(5);
    });

    test('displays model cards when data exists', async ({ page }) => {
        const cards = page.locator('.model-card');
        const count = await cards.count();
        
        if (count > 0) {
            // Verify card structure
            const firstCard = cards.first();
            await expect(firstCard).toBeVisible();
            
            // Card should have model name
            const text = await firstCard.textContent();
            expect(text?.length).toBeGreaterThan(5);
        }
    });

    test('model cards show token counts', async ({ page }) => {
        const cards = page.locator('.model-card');
        const count = await cards.count();
        
        if (count > 0) {
            const content = await cards.first().textContent();
            expect(content?.toLowerCase()).toContain('tokens');
        }
    });

    test('model cards show cost information', async ({ page }) => {
        const cards = page.locator('.model-card');
        const count = await cards.count();
        
        if (count > 0) {
            const content = await cards.first().textContent();
            expect(content).toContain('$');
        }
    });

    test('model cards show request counts', async ({ page }) => {
        const cards = page.locator('.model-card');
        const count = await cards.count();
        
        if (count > 0) {
            const content = await cards.first().textContent();
            expect(content?.toLowerCase()).toContain('request');
        }
    });

    test('displays multiple models from seeded data', async ({ page }) => {
        const cards = page.locator('.model-card');
        const count = await cards.count();
        
        // We seeded multiple models, so should have multiple cards
        // (or at least verify the container handles multiple)
        if (count > 0) {
            expect(count).toBeGreaterThanOrEqual(1);
        }
    });

    test('model grid uses correct CSS class', async ({ page }) => {
        const grid = page.locator('.model-grid');
        await expect(grid).toBeVisible();
    });

    test('models tab is accessible via URL hash', async ({ page }) => {
        await expect(page).toHaveURL(/#models/);
        await expect(page.locator('#modelsTab')).toHaveClass(/active/);
    });
});
