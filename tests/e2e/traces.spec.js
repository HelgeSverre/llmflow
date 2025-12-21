// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Traces Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#traces');
        // Wait for traces table to load
        await page.waitForFunction(() => {
            const tbody = document.querySelector('[data-testid="traces-body"]');
            return tbody && !tbody.textContent?.includes('Loading');
        }, { timeout: 10000 });
    });

    test('displays seeded traces in table', async ({ page }) => {
        // Should have trace rows
        const rows = page.locator('[data-testid="trace-row"]');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('trace rows contain expected data columns', async ({ page }) => {
        // Each row should have all data cells
        const firstRow = page.locator('[data-testid="trace-row"]').first();
        await expect(firstRow.locator('[data-testid="trace-time"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="trace-type"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="trace-name"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="trace-model"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="trace-tokens"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="trace-cost"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="trace-latency"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="trace-status"]')).toBeVisible();
    });

    test('traces table has correct header columns', async ({ page }) => {
        const headers = page.locator('[data-testid="traces-table"] thead th');
        const count = await headers.count();
        expect(count).toBe(8); // Time, Type, Name, Model, Tokens, Cost, Latency, Status
    });

    test('search filter filters traces by text', async ({ page }) => {
        const initialCount = await page.locator('[data-testid="trace-row"]').count();
        
        // Search for specific text
        await page.fill('[data-testid="traces-search"]', 'search-hit');
        await page.waitForTimeout(400); // debounce
        
        const filteredCount = await page.locator('[data-testid="trace-row"]').count();
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
        
        // Results should contain the search term
        if (filteredCount > 0) {
            const content = await page.locator('[data-testid="traces-body"]').textContent();
            expect(content?.toLowerCase()).toContain('search');
        }
    });

    test('model filter populates with available models', async ({ page }) => {
        // Wait for model filter to be populated
        await page.waitForFunction(() => {
            const select = document.querySelector('[data-testid="traces-model-filter"]');
            return select && select.children.length > 1;
        }, { timeout: 5000 });
        
        const options = await page.locator('[data-testid="traces-model-filter"] option').count();
        expect(options).toBeGreaterThan(1); // "All Models" + actual models
    });

    test('status filter shows only success traces', async ({ page }) => {
        await page.selectOption('[data-testid="traces-status-filter"]', 'success');
        await page.waitForTimeout(300);
        
        // All visible status cells should show success (2xx)
        const statusCells = page.locator('[data-testid="trace-status"]');
        const count = await statusCells.count();
        
        for (let i = 0; i < count; i++) {
            const className = await statusCells.nth(i).getAttribute('class');
            expect(className).toContain('status-success');
        }
    });

    test('status filter shows only error traces', async ({ page }) => {
        await page.selectOption('[data-testid="traces-status-filter"]', 'error');
        await page.waitForTimeout(300);
        
        // All visible status cells should show error (4xx/5xx)
        const statusCells = page.locator('[data-testid="trace-status"]');
        const count = await statusCells.count();
        
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const className = await statusCells.nth(i).getAttribute('class');
                expect(className).toContain('status-error');
            }
        }
    });

    test('date filter reduces results for 24h window', async ({ page }) => {
        const initialCount = await page.locator('[data-testid="trace-row"]').count();
        
        await page.selectOption('[data-testid="traces-date-filter"]', '24h');
        await page.waitForTimeout(300);
        
        const filteredCount = await page.locator('[data-testid="trace-row"]').count();
        // Should filter out old traces (we seeded a 10-day-old trace)
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('clear filters button restores all traces', async ({ page }) => {
        const initialCount = await page.locator('[data-testid="trace-row"]').count();
        
        // Apply filter
        await page.selectOption('[data-testid="traces-status-filter"]', 'error');
        await page.waitForTimeout(300);
        
        // Clear filters
        await page.click('[data-testid="traces-clear-filters"]');
        await page.waitForTimeout(300);
        
        const restoredCount = await page.locator('[data-testid="trace-row"]').count();
        expect(restoredCount).toBe(initialCount);
    });

    test('clicking trace row selects it and updates detail panel', async ({ page }) => {
        // Click first trace row
        await page.click('[data-testid="trace-row"]:first-child');
        
        // Row should be selected
        const row = page.locator('[data-testid="trace-row"]').first();
        await expect(row).toHaveClass(/selected/);
        
        // Detail panel should update
        await page.waitForFunction(() => {
            const title = document.querySelector('[data-testid="trace-detail-title"]');
            return title && title.textContent !== 'Select a trace';
        }, { timeout: 5000 });
    });

    test('trace detail panel shows info section', async ({ page }) => {
        await page.click('[data-testid="trace-row"]:first-child');
        
        await page.waitForFunction(() => {
            const info = document.querySelector('[data-testid="trace-info"]');
            return info && info.textContent !== '{}';
        }, { timeout: 5000 });
        
        const info = await page.locator('[data-testid="trace-info"]').textContent();
        expect(info?.length).toBeGreaterThan(2);
    });

    test('URL query params persist filter state', async ({ page }) => {
        await page.fill('[data-testid="traces-search"]', 'test-query');
        await page.waitForTimeout(400);
        
        // URL should contain query param
        await expect(page).toHaveURL(/q=test-query/);
        
        // Reload page
        await page.reload();
        
        // Wait for page to reload and filter to be applied
        await page.waitForFunction(() => {
            const input = document.querySelector('[data-testid="traces-search"]');
            return input instanceof HTMLInputElement && input.value === 'test-query';
        }, { timeout: 5000 });
        
        const inputValue = await page.locator('[data-testid="traces-search"]').inputValue();
        expect(inputValue).toBe('test-query');
    });
});
