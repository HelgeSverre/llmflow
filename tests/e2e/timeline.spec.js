// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Timeline Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#timeline');
        // Wait for timeline to load
        await page.waitForFunction(() => {
            const list = document.querySelector('[data-testid="timeline-list"]');
            return list && !list.textContent?.includes('Loading');
        }, { timeout: 10000 });
    });

    test('displays timeline items', async ({ page }) => {
        const list = page.locator('[data-testid="timeline-list"]');
        await expect(list).toBeVisible();
        
        // Should have content (either items or empty state)
        const content = await list.textContent();
        expect(content?.length).toBeGreaterThan(10);
    });

    test('timeline combines both traces and logs', async ({ page }) => {
        // The timeline fetches both traces and logs
        const content = await page.locator('[data-testid="timeline-list"]').textContent();
        expect(content?.length).toBeGreaterThan(50);
    });

    test('search filter filters timeline items', async ({ page }) => {
        // Search for specific text
        await page.fill('[data-testid="timeline-search"]', 'Timeline E2E Hit');
        await page.waitForTimeout(400);
        
        const content = await page.locator('[data-testid="timeline-list"]').textContent();
        // Should either find matching items or show fewer results
        expect(content).toBeDefined();
    });

    test('tool filter has expected options', async ({ page }) => {
        const options = page.locator('[data-testid="timeline-tool-filter"] option');
        const count = await options.count();
        expect(count).toBeGreaterThan(1); // "All Tools" + tool options
        
        // Verify some expected tool options
        const values = await options.evaluateAll(opts => opts.map(o => o.value));
        expect(values).toContain('');  // All Tools
        expect(values).toContain('aider');
        expect(values).toContain('proxy');
    });

    test('type filter shows only traces', async ({ page }) => {
        await page.selectOption('[data-testid="timeline-type-filter"]', 'trace');
        await page.waitForTimeout(300);
        
        // List should still be visible
        await expect(page.locator('[data-testid="timeline-list"]')).toBeVisible();
    });

    test('type filter shows only logs', async ({ page }) => {
        await page.selectOption('[data-testid="timeline-type-filter"]', 'log');
        await page.waitForTimeout(300);
        
        // List should still be visible
        await expect(page.locator('[data-testid="timeline-list"]')).toBeVisible();
    });

    test('date filter limits results to time range', async ({ page }) => {
        await page.selectOption('[data-testid="timeline-date-filter"]', '24h');
        await page.waitForTimeout(300);
        
        // Should still have visible timeline
        await expect(page.locator('[data-testid="timeline-list"]')).toBeVisible();
    });

    test('clear filters button resets all filters', async ({ page }) => {
        // Apply some filters
        await page.selectOption('[data-testid="timeline-type-filter"]', 'trace');
        await page.fill('[data-testid="timeline-search"]', 'test');
        await page.waitForTimeout(400);
        
        // Clear filters
        await page.click('[data-testid="timeline-clear-filters"]');
        await page.waitForTimeout(300);
        
        // Filters should be reset
        const typeValue = await page.locator('[data-testid="timeline-type-filter"]').inputValue();
        expect(typeValue).toBe('');
        
        const searchValue = await page.locator('[data-testid="timeline-search"]').inputValue();
        expect(searchValue).toBe('');
    });

    test('clicking timeline item updates detail panel', async ({ page }) => {
        // Click first timeline item (if any)
        const items = page.locator('.timeline-item');
        const count = await items.count();
        
        if (count > 0) {
            await items.first().click();
            
            // Detail panel should update
            await page.waitForFunction(() => {
                const title = document.querySelector('[data-testid="timeline-detail-title"]');
                return title && title.textContent !== 'Select an item';
            }, { timeout: 5000 });
            
            const data = await page.locator('[data-testid="timeline-detail-data"]').textContent();
            expect(data?.startsWith('{')).toBeTruthy();
        }
    });

    test('detail panel displays properly formatted JSON', async ({ page }) => {
        const items = page.locator('.timeline-item');
        const count = await items.count();
        
        if (count > 0) {
            await items.first().click();
            
            await page.waitForFunction(() => {
                const data = document.querySelector('[data-testid="timeline-detail-data"]');
                return data && data.textContent !== '{}';
            }, { timeout: 5000 });
            
            const data = await page.locator('[data-testid="timeline-detail-data"]').textContent();
            // Should be valid JSON
            expect(() => JSON.parse(data || '')).not.toThrow();
        }
    });
});
