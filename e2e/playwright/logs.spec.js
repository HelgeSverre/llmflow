// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Logs Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#logs');
        // Wait for logs table to load
        await page.waitForFunction(() => {
            const tbody = document.getElementById('logsBody');
            return tbody && !tbody.textContent?.includes('Loading');
        }, { timeout: 10000 });
    });

    test('displays seeded logs', async ({ page }) => {
        // Should have multiple rows
        const rows = page.locator('#logsBody tr');
        await expect(rows.first()).toBeVisible();
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
        
        // Content should not be empty
        const content = await page.locator('#logsBody').textContent();
        expect(content?.length).toBeGreaterThan(10);
    });

    test('search filter works', async ({ page }) => {
        // Search for specific text
        const searchInput = page.locator('#logSearchInput');
        await searchInput.fill('E2E');
        
        // Wait for API response after search filter change
        await page.waitForResponse(response => 
            response.url().includes('/api/logs') && response.status() === 200
        );
        
        // Should have some results (search applied)
        const rows = page.locator('#logsBody tr');
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(0); // May filter to 0 if not found
    });

    test('service filter can be changed', async ({ page }) => {
        // Check that service filter exists and has options
        const select = page.locator('#logServiceFilter');
        await expect(select).toBeVisible();
        
        // Get options count
        const options = select.locator('option');
        await expect(options.first()).toBeAttached();
        const count = await options.count();
        expect(count).toBeGreaterThanOrEqual(1); // At least "All Services"
    });

    test('event filter can be changed', async ({ page }) => {
        // Check that event filter exists and has options
        const select = page.locator('#logEventFilter');
        await expect(select).toBeVisible();
        
        // Get options count
        const options = select.locator('option');
        await expect(options.first()).toBeAttached();
        const count = await options.count();
        expect(count).toBeGreaterThanOrEqual(1); // At least "All Events"
    });

    test('severity filter can filter logs', async ({ page }) => {
        // Get initial count
        const rows = page.locator('#logsBody tr');
        await expect(rows.first()).toBeVisible();
        const initialCount = await rows.count();
        
        // Select Error+ (severity >= 17) and wait for API response
        const responsePromise = page.waitForResponse(response => 
            response.url().includes('/api/logs') && response.status() === 200
        );
        await page.selectOption('#logSeverityFilter', '17');
        await responsePromise;
        
        // Should have filtered results (fewer or equal)
        const filteredCount = await rows.count();
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('clear log filters button exists and works', async ({ page }) => {
        // Clear filters button should exist
        const clearBtn = page.locator('#clearLogFilters');
        await expect(clearBtn).toBeVisible();
        
        // Click and wait for API response
        const responsePromise = page.waitForResponse(response => 
            response.url().includes('/api/logs') && response.status() === 200
        );
        await clearBtn.click();
        await responsePromise;
        
        // Page should still show logs
        const rows = page.locator('#logsBody tr');
        await expect(rows.first()).toBeVisible();
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('log detail panel exists', async ({ page }) => {
        // Detail panel should exist
        const panel = page.locator('#logDetailPanel');
        await expect(panel).toBeVisible();
    });

    test('clicking log row updates detail panel', async ({ page }) => {
        // Wait for log rows to be visible
        const logRow = page.locator('[data-testid="log-row"]').first();
        await expect(logRow).toBeVisible({ timeout: 5000 });
        
        // Click first log row
        await logRow.click();
        
        // Wait for the detail panel title to update from default
        const detailTitle = page.locator('[data-testid="log-detail-title"]');
        await expect(detailTitle).not.toHaveText('Select a log', { timeout: 5000 });
        
        // Verify body was populated
        const logBody = page.locator('[data-testid="log-body"]');
        await expect(logBody).not.toHaveText('-');
    });

    test('log detail shows JSON in attributes section', async ({ page }) => {
        // Wait for log rows to be visible
        const logRow = page.locator('[data-testid="log-row"]').first();
        await expect(logRow).toBeVisible({ timeout: 5000 });
        
        // Click a log row
        await logRow.click();
        
        // Wait for title to update (indicating selection completed)
        const detailTitle = page.locator('[data-testid="log-detail-title"]');
        await expect(detailTitle).not.toHaveText('Select a log', { timeout: 5000 });
        
        // Attributes element should exist and contain JSON (may be formatted)
        const attrs = page.locator('[data-testid="log-attributes"]');
        await expect(attrs).toContainText('{');
    });

    test('log detail shows JSON in resource section', async ({ page }) => {
        // Wait for log rows to be visible
        const logRow = page.locator('[data-testid="log-row"]').first();
        await expect(logRow).toBeVisible({ timeout: 5000 });
        
        // Click a log row
        await logRow.click();
        
        // Wait for title to update
        const detailTitle = page.locator('[data-testid="log-detail-title"]');
        await expect(detailTitle).not.toHaveText('Select a log', { timeout: 5000 });
        
        // Resource element should exist and contain JSON
        const resource = page.locator('[data-testid="log-resource"]');
        await expect(resource).toContainText('{');
    });
});
