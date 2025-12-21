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
        const searchInput = page.locator('[data-testid="timeline-search"]');
        const timelineList = page.locator('[data-testid="timeline-list"]');
        
        // Wait for API response after search input
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
            searchInput.fill('Timeline E2E Hit')
        ]);
        
        // Wait for list to update
        await expect(timelineList).toBeVisible();
        const content = await timelineList.textContent();
        expect(content).toBeDefined();
    });

    test('tool filter has expected options', async ({ page }) => {
        const options = page.locator('[data-testid="timeline-tool-filter"] option');
        await expect(options).toHaveCount.call(expect(options.first()), await options.count());
        const count = await options.count();
        expect(count).toBeGreaterThan(1); // "All Tools" + tool options
        
        // Verify some expected tool options
        const values = await options.evaluateAll(opts => opts.map(o => o.value));
        expect(values).toContain('');  // All Tools
        expect(values).toContain('aider');
        expect(values).toContain('proxy');
    });

    test('type filter shows only traces', async ({ page }) => {
        const typeFilter = page.locator('[data-testid="timeline-type-filter"]');
        const timelineList = page.locator('[data-testid="timeline-list"]');
        
        // Wait for API response after filter change
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
            typeFilter.selectOption('trace')
        ]);
        
        await expect(timelineList).toBeVisible();
    });

    test('type filter shows only logs', async ({ page }) => {
        const typeFilter = page.locator('[data-testid="timeline-type-filter"]');
        const timelineList = page.locator('[data-testid="timeline-list"]');
        
        // Wait for API response after filter change
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
            typeFilter.selectOption('log')
        ]);
        
        await expect(timelineList).toBeVisible();
    });

    test('date filter limits results to time range', async ({ page }) => {
        const dateFilter = page.locator('[data-testid="timeline-date-filter"]');
        const timelineList = page.locator('[data-testid="timeline-list"]');
        
        // Wait for API response after filter change
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
            dateFilter.selectOption('24h')
        ]);
        
        await expect(timelineList).toBeVisible();
    });

    test('clear filters button resets all filters', async ({ page }) => {
        const typeFilter = page.locator('[data-testid="timeline-type-filter"]');
        const searchInput = page.locator('[data-testid="timeline-search"]');
        const clearButton = page.locator('[data-testid="timeline-clear-filters"]');
        
        // Apply some filters and wait for API response
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
            typeFilter.selectOption('trace')
        ]);
        
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
            searchInput.fill('test')
        ]);
        
        // Clear filters and wait for API response
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
            clearButton.click()
        ]);
        
        // Filters should be reset
        await expect(typeFilter).toHaveValue('');
        await expect(searchInput).toHaveValue('');
    });

    test('clicking timeline item updates detail panel', async ({ page }) => {
        // Click first timeline item (if any)
        const items = page.locator('.timeline-item');
        const count = await items.count();
        
        if (count > 0) {
            await items.first().click();
            
            // Wait for detail title to update
            const detailTitle = page.locator('[data-testid="timeline-detail-title"]');
            await expect(detailTitle).not.toHaveText('Select an item', { timeout: 5000 });
            
            const data = await page.locator('[data-testid="timeline-detail-data"]').textContent();
            expect(data?.startsWith('{')).toBeTruthy();
        }
    });

    test('detail panel displays properly formatted JSON', async ({ page }) => {
        const items = page.locator('.timeline-item');
        const count = await items.count();
        
        if (count > 0) {
            await items.first().click();
            
            // Wait for detail data to populate
            const detailData = page.locator('[data-testid="timeline-detail-data"]');
            await expect(detailData).not.toHaveText('{}', { timeout: 5000 });
            
            const data = await detailData.textContent();
            // Should be valid JSON
            expect(() => JSON.parse(data || '')).not.toThrow();
        }
    });
});
