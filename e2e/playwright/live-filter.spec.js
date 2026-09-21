const { test, expect } = require('@playwright/test')

test('live arrivals obey combined model, status, date and body search filters', async ({
    page,
    request,
}) => {
    const model = `live-model-${crypto.randomUUID()}`
    const marker = `needle-${crypto.randomUUID()}`
    const post = async (name, overrides = {}) => {
        const response = await request.post('/api/spans', {
            data: {
                id: crypto.randomUUID(),
                span_name: name,
                span_type: 'llm',
                model,
                status: 500,
                start_time: Date.now(),
                input: { text: marker },
                ...overrides,
            },
        })
        expect(response.ok()).toBeTruthy()
    }
    await post('matching-before')
    await page.goto('/#traces')
    await page.getByTestId('traces-model-filter').selectOption(model)
    await page.getByTestId('traces-status-filter').selectOption('error')
    await page.getByTestId('traces-date-filter').selectOption('1h')
    await page.getByTestId('traces-search').fill(marker)
    await expect(page.getByTestId('trace-row')).toHaveCount(1)
    await expect(page.getByTestId('trace-row')).toContainText('matching-before')
    const updated = page.waitForResponse(
        (response) =>
            response.url().includes('/api/traces?') &&
            response.url().includes('q=') &&
            response.status() === 200,
    )
    await post('wrong-model', { model: 'different' })
    await post('wrong-status', { status: 200 })
    await post('too-old', { start_time: Date.now() - 2 * 3600000 })
    await post('wrong-body', { input: { text: 'something else' } })
    await post('matching-live')
    await updated
    await expect(page.getByTestId('trace-row')).toHaveCount(2)
    await expect(page.getByTestId('trace-row').first()).toContainText('matching-live')
    await page.reload()
    // Filters are intentionally in-memory; reapply to compare with the fresh API query.
    await page.getByTestId('traces-model-filter').selectOption(model)
    await page.getByTestId('traces-status-filter').selectOption('error')
    await page.getByTestId('traces-date-filter').selectOption('1h')
    await page.getByTestId('traces-search').fill(marker)
    await expect(page.getByTestId('trace-row')).toHaveCount(2)
})
