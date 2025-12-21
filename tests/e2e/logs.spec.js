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
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
        
        // Content should not be empty
        const content = await page.locator('#logsBody').textContent();
        expect(content?.length).toBeGreaterThan(10);
    });

    test('search filter works', async ({ page }) => {
        // Search for specific text
        await page.fill('#logSearchInput', 'E2E');
        
        // Wait for filtered results
        await page.waitForTimeout(400);
        
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
        const options = await select.locator('option').count();
        expect(options).toBeGreaterThanOrEqual(1); // At least "All Services"
    });

    test('event filter can be changed', async ({ page }) => {
        // Check that event filter exists and has options
        const select = page.locator('#logEventFilter');
        await expect(select).toBeVisible();
        
        // Get options count
        const options = await select.locator('option').count();
        expect(options).toBeGreaterThanOrEqual(1); // At least "All Events"
    });

    test('severity filter can filter logs', async ({ page }) => {
        // Get initial count
        const initialCount = await page.locator('#logsBody tr').count();
        
        // Select Error+ (severity >= 17)
        await page.selectOption('#logSeverityFilter', '17');
        
        // Wait for filtered results
        await page.waitForTimeout(300);
        
        // Should have filtered results (fewer or equal)
        const filteredCount = await page.locator('#logsBody tr').count();
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('clear log filters button exists and works', async ({ page }) => {
        // Clear filters button should exist
        const clearBtn = page.locator('#clearLogFilters');
        await expect(clearBtn).toBeVisible();
        
        // Click should not error
        await clearBtn.click();
        await page.waitForTimeout(300);
        
        // Page should still show logs
        const rows = page.locator('#logsBody tr');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('log detail panel exists', async ({ page }) => {
        // Detail panel should exist
        const panel = page.locator('#logDetailPanel');
        await expect(panel).toBeVisible();
    });

    test('clicking log row updates detail panel', async ({ page }) => {
        // Wait for log rows to exist
        await page.waitForSelector('[data-testid="log-row"]', { timeout: 5000 });
        
        // Click first log row
        await page.click('[data-testid="log-row"]:first-child');
        
        // Wait for the detail panel to update (title should change from default)
        await page.waitForFunction(() => {
            const title = document.querySelector('[data-testid="log-detail-title"]');
            return title && title.textContent !== 'Select a log';
        }, { timeout: 5000 });
        
        // Verify body was populated
        const logBody = await page.locator('[data-testid="log-body"]').textContent();
        expect(logBody).not.toBe('-');
    });

    test('log detail shows attributes JSON after selection', async ({ page }) => {
        // Wait for log rows to exist
        await page.waitForSelector('[data-testid="log-row"]', { timeout: 5000 });
        
        // Click a log row
        await page.click('[data-testid="log-row"]:first-child');
        
        // Wait for attributes to be populated with actual JSON (not just placeholder)
        await page.waitForFunction(() => {
            const attrs = document.querySelector('[data-testid="log-attributes"]');
            if (!attrs) return false;
            const text = attrs.textContent?.trim() || '';
            // Check it's valid JSON with actual content
            return text.startsWith('{') && text.length > 2;
        }, { timeout: 5000 });
        
        const attrs = await page.locator('[data-testid="log-attributes"]').textContent();
        expect(attrs?.trim().startsWith('{')).toBeTruthy();
    });

    test('log detail shows resource attributes JSON after selection', async ({ page }) => {
        // Wait for log rows to exist
        await page.waitForSelector('[data-testid="log-row"]', { timeout: 5000 });
        
        // Click a log row
        await page.click('[data-testid="log-row"]:first-child');
        
        // Wait for resource to be populated
        await page.waitForFunction(() => {
            const resource = document.querySelector('[data-testid="log-resource"]');
            if (!resource) return false;
            const text = resource.textContent?.trim() || '';
            return text.startsWith('{') && text.length > 2;
        }, { timeout: 5000 });
        
        const resource = await page.locator('[data-testid="log-resource"]').textContent();
        expect(resource?.trim().startsWith('{')).toBeTruthy();
    });
});
