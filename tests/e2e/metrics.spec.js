// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Metrics Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#metrics');
        // Wait for metrics to load
        await page.waitForFunction(() => {
            const body = document.querySelector('[data-testid="metrics-body"]');
            return body && !body.textContent?.includes('Loading');
        }, { timeout: 10000 });
    });

    test('displays metrics summary section', async ({ page }) => {
        const summary = page.locator('[data-testid="metrics-summary"]');
        await expect(summary).toBeVisible();
        
        const content = await summary.textContent();
        expect(content?.length).toBeGreaterThan(5);
    });

    test('displays metrics table with rows', async ({ page }) => {
        const rows = page.locator('[data-testid="metrics-body"] tr');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('metrics table has correct header columns', async ({ page }) => {
        const headers = page.locator('[data-testid="metrics-table"] thead th');
        const count = await headers.count();
        expect(count).toBe(5); // Time, Type, Name, Value, Service
    });

    test('name filter populates with metric names', async ({ page }) => {
        // Wait for filter to be populated
        await page.waitForFunction(() => {
            const select = document.querySelector('[data-testid="metrics-name-filter"]');
            return select && select.children.length > 1;
        }, { timeout: 5000 });
        
        const options = await page.locator('[data-testid="metrics-name-filter"] option').count();
        expect(options).toBeGreaterThan(1);
    });

    test('service filter populates with service names', async ({ page }) => {
        // Wait for filter to be populated
        await page.waitForFunction(() => {
            const select = document.querySelector('[data-testid="metrics-service-filter"]');
            return select && select.children.length > 1;
        }, { timeout: 5000 });
        
        const options = await page.locator('[data-testid="metrics-service-filter"] option').count();
        expect(options).toBeGreaterThan(1);
    });

    test('type filter shows only sum metrics', async ({ page }) => {
        await page.selectOption('[data-testid="metrics-type-filter"]', 'sum');
        await page.waitForTimeout(300);
        
        // All visible metric badges should be sum type
        const badges = page.locator('[data-testid="metrics-body"] .metric-badge');
        const count = await badges.count();
        
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const className = await badges.nth(i).getAttribute('class');
                expect(className).toContain('metric-sum');
            }
        }
    });

    test('type filter shows only gauge metrics', async ({ page }) => {
        await page.selectOption('[data-testid="metrics-type-filter"]', 'gauge');
        await page.waitForTimeout(300);
        
        const badges = page.locator('[data-testid="metrics-body"] .metric-badge');
        const count = await badges.count();
        
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const className = await badges.nth(i).getAttribute('class');
                expect(className).toContain('metric-gauge');
            }
        }
    });

    test('type filter shows only histogram metrics', async ({ page }) => {
        await page.selectOption('[data-testid="metrics-type-filter"]', 'histogram');
        await page.waitForTimeout(300);
        
        const badges = page.locator('[data-testid="metrics-body"] .metric-badge');
        const count = await badges.count();
        
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const className = await badges.nth(i).getAttribute('class');
                expect(className).toContain('metric-histogram');
            }
        }
    });

    test('clear filters button resets all filters', async ({ page }) => {
        // Apply a filter
        await page.selectOption('[data-testid="metrics-type-filter"]', 'gauge');
        await page.waitForTimeout(300);
        
        const filteredCount = await page.locator('[data-testid="metrics-body"] tr').count();
        
        // Clear filters
        await page.click('[data-testid="metrics-clear-filters"]');
        await page.waitForTimeout(300);
        
        // Should have more or equal rows
        const allCount = await page.locator('[data-testid="metrics-body"] tr').count();
        expect(allCount).toBeGreaterThanOrEqual(filteredCount);
        
        // Filter should be reset
        const typeValue = await page.locator('[data-testid="metrics-type-filter"]').inputValue();
        expect(typeValue).toBe('');
    });

    test('metrics table shows type badges', async ({ page }) => {
        const badges = page.locator('[data-testid="metrics-body"] .metric-badge');
        const count = await badges.count();
        expect(count).toBeGreaterThan(0);
    });

    test('metrics table shows metric values', async ({ page }) => {
        const rows = page.locator('[data-testid="metrics-body"] tr');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
        
        // Check that at least one row has a value
        const values = page.locator('[data-testid="metrics-body"] .metric-value');
        const valueCount = await values.count();
        expect(valueCount).toBeGreaterThan(0);
    });
});
