// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Navigation & URL Hash Persistence', () => {
    test('default load shows Timeline tab', async ({ page }) => {
        await page.goto('/');
        
        // Timeline tab should be active
        await expect(page.locator('#timelineTab')).toHaveClass(/active/);
        
        // Hash should be set to timeline
        await expect(page).toHaveURL(/#timeline/);
    });

    test('clicking tabs updates hash and shows correct content', async ({ page }) => {
        await page.goto('/');

        // Click Traces tab
        await page.click('[data-testid="tab-traces"]');
        await expect(page.locator('#tracesTab')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#traces/);
        await expect(page.locator('#timelineTab')).not.toHaveClass(/active/);

        // Click Logs tab
        await page.click('[data-testid="tab-logs"]');
        await expect(page.locator('#logsTab')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#logs/);

        // Click Metrics tab
        await page.click('[data-testid="tab-metrics"]');
        await expect(page.locator('#metricsTab')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#metrics/);

        // Click Models tab
        await page.click('[data-testid="tab-models"]');
        await expect(page.locator('#modelsTab')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#models/);

        // Click Analytics tab
        await page.click('[data-testid="tab-analytics"]');
        await expect(page.locator('#analyticsTab')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#analytics/);
    });

    test('direct deep-link to logs tab works', async ({ page }) => {
        await page.goto('/#logs');
        await expect(page.locator('#logsTab')).toHaveClass(/active/);
    });

    test('direct deep-link to analytics tab works', async ({ page }) => {
        await page.goto('/#analytics');
        await expect(page.locator('#analyticsTab')).toHaveClass(/active/);
    });

    test('direct deep-link to metrics tab works', async ({ page }) => {
        await page.goto('/#metrics');
        await expect(page.locator('#metricsTab')).toHaveClass(/active/);
    });

    test('direct deep-link to traces tab works', async ({ page }) => {
        await page.goto('/#traces');
        await expect(page.locator('#tracesTab')).toHaveClass(/active/);
    });

    test('direct deep-link to models tab works', async ({ page }) => {
        await page.goto('/#models');
        await expect(page.locator('#modelsTab')).toHaveClass(/active/);
    });

    test('stats bar displays all stat elements', async ({ page }) => {
        await page.goto('/');
        
        // Stats bar should exist with all stats
        await expect(page.locator('[data-testid="stats-bar"]')).toBeVisible();
        await expect(page.locator('[data-testid="total-requests"]')).toBeVisible();
        await expect(page.locator('[data-testid="total-tokens"]')).toBeVisible();
        await expect(page.locator('[data-testid="total-cost"]')).toBeVisible();
        await expect(page.locator('[data-testid="avg-latency"]')).toBeVisible();
    });

    test('stats bar values update with data', async ({ page }) => {
        await page.goto('/');
        
        // Wait for stats to potentially load
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-testid="total-requests"]');
            return el && el.textContent !== '-';
        }, { timeout: 5000 });
        
        // Stats should show numeric values (from seeded data)
        const totalRequests = await page.locator('[data-testid="total-requests"]').textContent();
        expect(parseInt(totalRequests || '0')).toBeGreaterThan(0);
    });

    test('connection status indicator exists', async ({ page }) => {
        await page.goto('/');
        
        // Connection status dot should exist
        await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
    });

    test('theme toggle switches between light and dark', async ({ page }) => {
        await page.goto('/');
        
        // Get initial theme state
        const initialTheme = await page.locator('html').getAttribute('data-theme');
        
        // Click theme toggle
        await page.click('[data-testid="theme-toggle"]');
        
        // Theme should change
        const afterToggle = await page.locator('html').getAttribute('data-theme');
        expect(afterToggle !== initialTheme).toBeTruthy();
        
        // Toggle again
        await page.click('[data-testid="theme-toggle"]');
        
        // Should be back to initial
        const afterSecondToggle = await page.locator('html').getAttribute('data-theme');
        expect(afterSecondToggle).toBe(initialTheme);
    });

    test('theme preference persists via localStorage', async ({ page }) => {
        await page.goto('/');
        
        // Toggle to dark theme
        await page.click('[data-testid="theme-toggle"]');
        
        // Wait a moment for localStorage to update
        await page.waitForTimeout(100);
        
        // Check localStorage
        const theme = await page.evaluate(() => localStorage.getItem('llmflow-theme'));
        expect(['light', 'dark']).toContain(theme);
    });

    test('all tabs exist in navigation', async ({ page }) => {
        await page.goto('/');
        
        await expect(page.locator('[data-testid="tab-timeline"]')).toBeVisible();
        await expect(page.locator('[data-testid="tab-traces"]')).toBeVisible();
        await expect(page.locator('[data-testid="tab-logs"]')).toBeVisible();
        await expect(page.locator('[data-testid="tab-metrics"]')).toBeVisible();
        await expect(page.locator('[data-testid="tab-models"]')).toBeVisible();
        await expect(page.locator('[data-testid="tab-analytics"]')).toBeVisible();
    });

    test('back/forward navigation syncs tab state', async ({ page }) => {
        await page.goto('/');
        
        // Navigate through tabs
        await page.click('[data-testid="tab-traces"]');
        await expect(page).toHaveURL(/#traces/);
        
        await page.click('[data-testid="tab-logs"]');
        await expect(page).toHaveURL(/#logs/);
        
        // Go back
        await page.goBack();
        await expect(page).toHaveURL(/#traces/);
        await expect(page.locator('#tracesTab')).toHaveClass(/active/);
        
        // Go forward
        await page.goForward();
        await expect(page).toHaveURL(/#logs/);
        await expect(page.locator('#logsTab')).toHaveClass(/active/);
    });

    test('logo is visible with correct branding', async ({ page }) => {
        await page.goto('/');
        
        const logo = page.locator('[data-testid="logo"]');
        await expect(logo).toBeVisible();
        await expect(logo).toContainText('LLMFlow');
    });
});
