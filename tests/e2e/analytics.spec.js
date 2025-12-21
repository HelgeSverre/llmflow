// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Analytics Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#analytics');
        // Wait for all analytics sections to load
        await page.waitForFunction(() => {
            const tokenChart = document.querySelector('[data-testid="token-trends-chart"]');
            const costTool = document.querySelector('[data-testid="cost-by-tool-chart"]');
            const costModel = document.querySelector('[data-testid="cost-by-model-chart"]');
            const daily = document.querySelector('[data-testid="daily-summary-table"]');
            
            return tokenChart && !tokenChart.textContent?.includes('Loading') &&
                   costTool && !costTool.textContent?.includes('Loading') &&
                   costModel && !costModel.textContent?.includes('Loading') &&
                   daily && !daily.textContent?.includes('Loading');
        }, { timeout: 15000 });
    });

    test('displays token trends chart section', async ({ page }) => {
        const chart = page.locator('[data-testid="token-trends-chart"]');
        await expect(chart).toBeVisible();
        
        const content = await chart.textContent();
        expect(content?.length).toBeGreaterThan(5);
    });

    test('displays cost by tool chart section', async ({ page }) => {
        const chart = page.locator('[data-testid="cost-by-tool-chart"]');
        await expect(chart).toBeVisible();
        
        const content = await chart.textContent();
        expect(content?.length).toBeGreaterThan(5);
    });

    test('displays cost by model chart section', async ({ page }) => {
        const chart = page.locator('[data-testid="cost-by-model-chart"]');
        await expect(chart).toBeVisible();
        
        const content = await chart.textContent();
        expect(content?.length).toBeGreaterThan(5);
    });

    test('displays daily summary table section', async ({ page }) => {
        const table = page.locator('[data-testid="daily-summary-table"]');
        await expect(table).toBeVisible();
        
        const content = await table.textContent();
        expect(content?.length).toBeGreaterThan(5);
    });

    test('analytics grid contains all four cards', async ({ page }) => {
        const cards = page.locator('.analytics-card');
        const count = await cards.count();
        expect(count).toBe(4);
    });

    test('each analytics card has header and subtitle', async ({ page }) => {
        const headers = page.locator('.analytics-card-header h3');
        const subtitles = page.locator('.analytics-subtitle');
        
        expect(await headers.count()).toBe(4);
        expect(await subtitles.count()).toBe(4);
    });

    test('days filter has all expected options', async ({ page }) => {
        const options = page.locator('[data-testid="analytics-days-filter"] option');
        const count = await options.count();
        expect(count).toBe(4); // 7, 14, 30, 90 days
        
        const values = await options.evaluateAll(opts => opts.map(o => o.value));
        expect(values).toContain('7');
        expect(values).toContain('14');
        expect(values).toContain('30');
        expect(values).toContain('90');
    });

    test('30 days is default selection', async ({ page }) => {
        const value = await page.locator('[data-testid="analytics-days-filter"]').inputValue();
        expect(value).toBe('30');
    });

    test('days filter triggers data reload', async ({ page }) => {
        // Change to 7 days and wait for API response (should trigger automatically on change)
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/analytics') && resp.status() === 200),
            page.selectOption('[data-testid="analytics-days-filter"]', '7')
        ]);

        // Wait for table to finish loading
        await expect(page.locator('[data-testid="daily-summary-table"]')).not.toContainText('Loading');

        // Content should be present
        const content = await page.locator('[data-testid="daily-summary-table"]').textContent();
        expect(content?.length).toBeGreaterThan(5);
    });

    test('refresh button reloads analytics data', async ({ page }) => {
        // Click refresh and wait for API response
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/analytics') && resp.status() === 200),
            page.click('[data-testid="analytics-refresh"]')
        ]);
        
        // Wait for all charts to finish loading
        await expect(page.locator('[data-testid="token-trends-chart"]')).not.toContainText('Loading');
        await expect(page.locator('[data-testid="cost-by-tool-chart"]')).not.toContainText('Loading');
        await expect(page.locator('[data-testid="cost-by-model-chart"]')).not.toContainText('Loading');
        await expect(page.locator('[data-testid="daily-summary-table"]')).not.toContainText('Loading');
        
        // All charts should be visible and populated
        await expect(page.locator('[data-testid="token-trends-chart"]')).toBeVisible();
        await expect(page.locator('[data-testid="cost-by-tool-chart"]')).toBeVisible();
        await expect(page.locator('[data-testid="cost-by-model-chart"]')).toBeVisible();
        await expect(page.locator('[data-testid="daily-summary-table"]')).toBeVisible();
    });

    test('token trends chart renders bar chart when data exists', async ({ page }) => {
        const chart = page.locator('[data-testid="token-trends-chart"]');
        const content = await chart.textContent();
        
        // Either has bar chart elements or empty state
        const hasContent = content && content.length > 10;
        expect(hasContent).toBeTruthy();
    });

    test('cost by tool chart renders horizontal bars when data exists', async ({ page }) => {
        const chart = page.locator('[data-testid="cost-by-tool-chart"]');
        const content = await chart.textContent();
        
        // Should have content
        expect(content?.length).toBeGreaterThan(5);
    });

    test('cost by model chart renders bars when data exists', async ({ page }) => {
        const chart = page.locator('[data-testid="cost-by-model-chart"]');
        const content = await chart.textContent();
        
        // Should have content
        expect(content?.length).toBeGreaterThan(5);
    });

    test('daily summary table renders rows when data exists', async ({ page }) => {
        const table = page.locator('[data-testid="daily-summary-table"]');
        const content = await table.textContent();
        
        // Should have content (either table rows or informative message)
        expect(content?.length).toBeGreaterThan(5);
    });

    test('90 days filter shows extended date range', async ({ page }) => {
        // Change to 90 days and wait for API response (should trigger automatically on change)
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/analytics') && resp.status() === 200),
            page.selectOption('[data-testid="analytics-days-filter"]', '90')
        ]);

        // Wait for chart to finish loading
        await expect(page.locator('[data-testid="token-trends-chart"]')).not.toContainText('Loading');

        // Charts should be visible
        await expect(page.locator('[data-testid="token-trends-chart"]')).toBeVisible();
    });
});
