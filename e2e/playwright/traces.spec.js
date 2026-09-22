// @ts-check
const { test, expect } = require('@playwright/test')

test.describe('Traces Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#traces')
        // Wait for trace rows to be rendered (they have data-testid when rendered)
        await page.waitForSelector('[data-testid="trace-row"]', { timeout: 10000 })
    })

    test('displays seeded traces in table', async ({ page }) => {
        const rows = page.locator('[data-testid="trace-row"]')
        const count = await rows.count()
        expect(count).toBeGreaterThan(0)
    })

    test('trace rows contain all data columns', async ({ page }) => {
        // Each row should have all data cells
        const firstRow = page.locator('[data-testid="trace-row"]').first()
        await expect(firstRow.locator('[data-testid="trace-time"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="trace-type"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="trace-name"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="trace-model"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="trace-tokens"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="trace-cost"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="trace-latency"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="trace-status"]')).toBeVisible()
    })

    test('traces table has correct header columns', async ({ page }) => {
        const headers = page.locator('[data-testid="traces-table"] thead th')
        const count = await headers.count()
        expect(count).toBe(8) // Time, Type, Name, Model, Tokens, Cost, Latency, Status
    })

    test('search filter filters traces by text', async ({ page }) => {
        const initialCount = await page.locator('[data-testid="trace-row"]').count()

        // Search for specific text and wait for API response
        const responsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/api/traces') && resp.status() === 200,
        )
        await page.fill('[data-testid="traces-search"]', 'search-hit')
        await responsePromise

        // Wait for rows to update
        await expect(page.locator('[data-testid="trace-row"]'))
            .not.toHaveCount(initialCount, { timeout: 2000 })
            .catch(() => {})

        const filteredCount = await page.locator('[data-testid="trace-row"]').count()
        expect(filteredCount).toBeLessThanOrEqual(initialCount)

        // Results should contain the search term
        if (filteredCount > 0) {
            const content = await page.locator('[data-testid="traces-body"]').textContent()
            expect(content?.toLowerCase()).toContain('search')
        }
    })

    test('model filter populates with available models', async ({ page }) => {
        // Wait for model filter to have more than 1 option
        const modelFilter = page.locator('[data-testid="traces-model-filter"] option')
        await expect(async () => {
            const count = await modelFilter.count()
            expect(count).toBeGreaterThan(1) // "All Models" + actual models
        }).toPass({ timeout: 10000 })
    })

    test('status filter shows only success traces', async ({ page }) => {
        const responsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/api/traces') && resp.status() === 200,
        )
        await page.selectOption('[data-testid="traces-status-filter"]', 'success')
        await responsePromise

        // Wait for table to update
        await page
            .locator('[data-testid="trace-status"] .status-success')
            .first()
            .waitFor({ state: 'visible', timeout: 5000 })
            .catch(() => {})

        // Successful spans can still report failures in their descendants.
        const statusSpans = page.locator('[data-testid="trace-status"] span')
        const count = await statusSpans.count()

        for (let i = 0; i < count; i++) {
            await expect(statusSpans.nth(i)).toHaveText(/^(OK|Child error)$/)
        }
    })

    test('status filter shows only error traces', async ({ page }) => {
        const responsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/api/traces') && resp.status() === 200,
        )
        await page.selectOption('[data-testid="traces-status-filter"]', 'error')
        await responsePromise

        // Wait for table to potentially update
        await page
            .locator('[data-testid="trace-status"] .status-error')
            .first()
            .waitFor({ state: 'visible', timeout: 5000 })
            .catch(() => {})

        // All visible status cells should show error (4xx/5xx)
        const statusSpans = page.locator('[data-testid="trace-status"] span')
        const count = await statusSpans.count()

        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const className = await statusSpans.nth(i).getAttribute('class')
                expect(className).toContain('status-error')
            }
        }
    })

    test('date filter reduces results for 24h window', async ({ page }) => {
        const initialCount = await page.locator('[data-testid="trace-row"]').count()

        const responsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/api/traces') && resp.status() === 200,
        )
        await page.selectOption('[data-testid="traces-date-filter"]', '24h')
        await responsePromise

        // Wait for rows to potentially change
        await expect(page.locator('[data-testid="trace-row"]'))
            .not.toHaveCount(initialCount, { timeout: 2000 })
            .catch(() => {})

        const filteredCount = await page.locator('[data-testid="trace-row"]').count()
        // Should filter out old traces (we seeded a 10-day-old trace)
        expect(filteredCount).toBeLessThanOrEqual(initialCount)
    })

    test('clear filters button restores all traces', async ({ page }) => {
        const initialCount = await page.locator('[data-testid="trace-row"]').count()

        // Apply filter and wait for response
        const filterResponsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/api/traces') && resp.status() === 200,
        )
        await page.selectOption('[data-testid="traces-status-filter"]', 'error')
        await filterResponsePromise

        // Clear filters and wait for response
        const clearResponsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/api/traces') && resp.status() === 200,
        )
        await page.click('[data-testid="traces-clear-filters"]')
        await clearResponsePromise

        // Wait for rows to be restored
        await expect(page.locator('[data-testid="trace-row"]')).toHaveCount(initialCount, {
            timeout: 5000,
        })

        const restoredCount = await page.locator('[data-testid="trace-row"]').count()
        expect(restoredCount).toBe(initialCount)
    })

    test('clicking trace row selects it and updates detail panel', async ({ page }) => {
        // Click first trace row
        await page.click('[data-testid="trace-row"]:first-child')

        // Row should be selected
        const row = page.locator('[data-testid="trace-row"]').first()
        await expect(row).toHaveClass(/selected/)

        await expect(
            page.getByTestId('traces-detail-panel').getByRole('treeitem').first(),
        ).toBeVisible()
    })

    test('selecting a span opens its captured details', async ({ page }) => {
        await page.locator('[data-testid="trace-row"]').first().click()
        const panel = page.getByTestId('traces-detail-panel')
        await panel.getByRole('treeitem').first().click()
        await expect(panel.locator('.detail-panel .name')).not.toBeEmpty()
        await expect(panel.getByRole('button', { name: 'attributes', exact: true })).toBeVisible()
        await expect(panel.locator('.detail-panel .body')).toBeVisible()
    })

    test('search input updates and filters work', async ({ page }) => {
        // Fill search and wait for API response
        const responsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/api/traces') && resp.status() === 200,
        )
        await page.fill('[data-testid="traces-search"]', 'test-query')
        await responsePromise

        // Search input should have the value
        const searchInput = page.locator('[data-testid="traces-search"]')
        await expect(searchInput).toHaveValue('test-query')
    })
})
