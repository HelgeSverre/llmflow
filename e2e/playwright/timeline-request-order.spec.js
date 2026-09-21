const { test, expect } = require('@playwright/test')

test('Timeline filters fetch once and Clear cancels pending search', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
    const queries = []
    await page.route('**/api/timeline?*', async (route) => {
        queries.push(new URL(route.request().url()).searchParams)
        await route.fulfill({ json: [] })
    })
    await page.goto('/#timeline')
    await expect.poll(() => queries.length).toBe(1)
    await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'))

    async function change(action, verify) {
        queries.length = 0
        await action()
        await page.clock.runFor(400)
        await expect.poll(() => queries.length).toBe(1)
        verify(queries[0])
    }
    await change(
        () => page.getByTestId('timeline-type-filter').selectOption('log'),
        (query) => expect(query.get('type')).toBe('log'),
    )
    await change(
        () => page.getByTestId('timeline-tool-filter').fill('custom-service'),
        (query) => expect(query.get('tool')).toBe('custom-service'),
    )
    await change(
        () => page.getByTestId('timeline-date-filter').selectOption('24h'),
        (query) => expect(query.has('date_from')).toBe(true),
    )
    await change(
        () => page.getByTestId('timeline-search').fill('applied query'),
        (query) => expect(query.get('q')).toBe('applied query'),
    )

    queries.length = 0
    await page.getByTestId('timeline-search').fill('obsolete pending query')
    await page.getByTestId('timeline-clear-filters').click()
    await page.clock.runFor(400)
    await expect(page.getByTestId('timeline-search')).toHaveValue('')
    expect(queries.map((query) => query.toString())).toEqual(['limit=100'])
})

for (const tab of ['traces', 'logs']) {
    test(`${tab} Clear cancels pending search before it can reapply`, async ({ page }) => {
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
        const queries = []
        await page.route(`**/api/${tab}?*`, async (route) => {
            queries.push(new URL(route.request().url()).searchParams)
            await route.fulfill({ json: tab === 'logs' ? { logs: [] } : [] })
        })
        await page.goto(`/#${tab}`)
        await expect.poll(() => queries.length).toBeGreaterThan(0)
        await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'))
        queries.length = 0
        await page.getByTestId(`${tab}-search`).fill('obsolete pending query')
        await page.getByTestId(`${tab}-clear-filters`).click()
        await page.clock.runFor(400)
        await expect(page.getByTestId(`${tab}-search`)).toHaveValue('')
        expect(queries.length).toBeGreaterThan(0)
        expect(queries.every((query) => !query.has('q'))).toBe(true)
    })
}
