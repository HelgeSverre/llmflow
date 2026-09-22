const { test, expect } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs')
const evidence = path.join(__dirname, '../../.backlog/assets/design-fixes-2026-09-22')

async function seed(request) {
    const key = crypto.randomUUID()
    const trace = key.replaceAll('-', ''),
        root = crypto.randomUUID().replaceAll('-', '').slice(0, 16),
        child = crypto.randomUUID().replaceAll('-', '').slice(0, 16),
        session = `session-${key}`
    for (const data of [
        {
            id: root,
            trace_id: trace,
            session_id: session,
            span_name: 'Design investigation root',
            service_name: 'design-review',
            status: 200,
            input: { question: 'Read this captured input' },
        },
        {
            id: child,
            trace_id: trace,
            parent_id: root,
            span_name: 'Design failed tool',
            service_name: 'design-review',
            status: 500,
            error: 'Tool could not complete',
            output: { failure: 'Useful error detail' },
        },
    ])
        expect(
            (
                await request.post('/api/spans', {
                    data: {
                        ...data,
                        duration_ms: 120,
                        estimated_cost: 0.00000123,
                        total_tokens: 1234,
                    },
                })
            ).ok(),
        ).toBe(true)
    const now = String(BigInt(Date.now()) * 1000000n)
    expect(
        (
            await request.post('/v1/logs', {
                data: {
                    resourceLogs: [
                        {
                            resource: {
                                attributes: [
                                    {
                                        key: 'service.name',
                                        value: { stringValue: 'design-review' },
                                    },
                                ],
                            },
                            scopeLogs: [
                                {
                                    logRecords: [
                                        {
                                            timeUnixNano: now,
                                            severityNumber: 17,
                                            severityText: 'ERROR',
                                            body: { stringValue: `Design log body ${key}` },
                                            attributes: [
                                                {
                                                    key: 'event.name',
                                                    value: { stringValue: 'design.event' },
                                                },
                                            ],
                                            traceId: trace,
                                            spanId: child,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            })
        ).ok(),
    ).toBe(true)
    return { key, root, child, trace, session }
}

for (const [tab, endpoint, content] of [
    ['timeline', '/api/timeline', '.timeline-item'],
    ['traces', '/api/traces', '[data-testid="trace-row"]'],
    ['logs', '/api/logs', '[data-testid="log-row"]'],
    ['metrics', '/api/metrics', '.metric-row'],
    ['models', '/api/models', '.model-card'],
    ['analytics', '/api/analytics', '[data-testid="daily-summary-table"] tbody tr'],
]) {
    test(`${tab}: initial failure, retry and failed refresh preserve data`, async ({ page }) => {
        let fail = true
        await page.route(`**${endpoint}?**`, (route) =>
            fail
                ? route.fulfill({ status: 503, json: { error: 'Fixture outage' } })
                : route.continue(),
        )
        await page.goto(`/#${tab}`)
        const active = page.locator('.tab-content.active')
        await expect(active.getByRole('alert').first()).toContainText('Could not load')
        await expect(active.locator(content)).toHaveCount(0)
        fail = false
        await active.getByRole('button', { name: 'Retry', exact: true }).first().click()
        await expect(active.locator(content).first()).toBeVisible()
        const previous = await active.locator(content).count()
        fail = true
        await active.getByRole('button', { name: 'Refresh', exact: true }).click()
        await expect(active.getByRole('alert').first()).toContainText('Showing previous results')
        await expect(active.locator(content)).toHaveCount(previous)
    })
}

test('failed child is visible in lists, waterfall and keyboard session navigation', async ({
    page,
    request,
}) => {
    const ids = await seed(request)
    const list = await (await request.get(`/api/traces?q=Design%20investigation%20root`)).json()
    expect(list.find((row) => row.id === ids.root).has_child_error).toBe(1)
    await page.goto('/#traces')
    const root = page.locator(`[data-trace-id="${ids.root}"]`)
    await expect(root).toContainText('Child error')
    await root.click()
    const panel = page.getByTestId('traces-detail-panel')
    await expect(panel.locator('.detail-panel .name')).toHaveText('Design investigation root')
    await expect(panel.locator('.detail-panel .body')).toContainText('Read this captured input')
    await expect(
        panel.getByRole('treeitem', { name: 'Design failed tool', exact: true }),
    ).toContainText('Error')
    await expect(panel.getByRole('button', { name: 'Replay request' })).toBeDisabled()
    await expect(panel).toContainText('telemetry-only spans cannot be replayed')
    await page.getByTestId('tab-sessions').click()
    await page.getByRole('textbox', { name: 'Search sessions' }).fill(ids.session)
    const session = page.getByRole('button', { name: ids.session, exact: true })
    await session.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.session-detail')).toContainText('Design investigation root')
    await expect(page.locator('.summary')).toContainText('1 trace')
    await page.getByRole('button', { name: 'View failed span' }).focus()
    await page.keyboard.press('Enter')
    await expect(panel.locator('.detail-panel .name')).toHaveText('Design failed tool')
    await expect(panel.locator('.detail-panel')).toContainText('$0.00000123')
})

test('Logs and Timeline open the correlated span and retain source filters', async ({
    page,
    request,
    context,
}) => {
    const ids = await seed(request)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    for (const tab of ['logs', 'timeline']) {
        await page.goto(`/#${tab}`)
        await page.getByTestId(`${tab}-search`).fill(ids.key)
        const row = page
            .locator(tab === 'logs' ? '[data-testid="log-row"]' : '.timeline-item')
            .filter({ hasText: `Design log body ${ids.key}` })
        await row.click()
        const panel = page.getByTestId(`${tab}-detail-panel`)
        await expect(panel.getByRole('button', { name: 'Open trace', exact: true })).toBeEnabled()
        await panel.getByRole('button', { name: 'Copy span ID' }).click()
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(ids.child)
        await expect(panel.getByRole('button', { name: 'Open session' })).toBeVisible()
        await panel.getByRole('button', { name: 'Open trace', exact: true }).click()
        await expect(
            page.getByTestId('traces-detail-panel').locator('.detail-panel .name'),
        ).toHaveText('Design failed tool')
        await page.getByTestId(`tab-${tab}`).click()
        await expect(page.getByTestId(`${tab}-search`)).toHaveValue(ids.key)
        await expect(row).toHaveClass(/selected/)
    }
})

test('model drill-down uses the exact aggregate time window and sorting', async ({
    page,
    request,
}) => {
    const model = `design-model-${crypto.randomUUID()}`
    for (const [age, cost] of [
        [1, 1.25],
        [10, 8],
    ]) {
        await request.post('/api/spans', {
            data: {
                id: crypto.randomUUID(),
                span_name: model,
                model,
                start_time: Date.now() - age * 86400000,
                estimated_cost: cost,
            },
        })
    }
    await page.goto('/#models')
    const response = page.waitForResponse(
        (r) =>
            r.url().includes('/api/models?') &&
            new URL(r.url()).searchParams.get('date_from') !== '0',
    )
    await page.getByRole('combobox', { name: 'Model time range' }).selectOption('7')
    const scope = new URL((await response).url()).searchParams
    const card = page.locator('.model-card').filter({ hasText: model })
    await expect(card).toContainText('$1.25')
    await page.getByRole('combobox', { name: 'Sort models' }).selectOption('cost')
    const traceResponse = page.waitForResponse(
        (r) =>
            r.url().includes('/api/traces?') &&
            new URL(r.url()).searchParams.get('model') === model,
    )
    await card.getByRole('button', { name: 'View traces' }).click()
    const traces = await traceResponse
    const params = new URL(traces.url()).searchParams
    expect(params.get('date_from')).toBe(scope.get('date_from'))
    expect(params.get('date_to')).toBe(scope.get('date_to'))
    await expect(page.getByTestId('trace-row')).toHaveCount(1)
    await expect(page.getByTestId('traces-model-filter')).toHaveValue(model)
})

test('metric units and series action agree with the filtered API', async ({ page, request }) => {
    const name = `design-latency-${crypto.randomUUID()}`
    await request.post('/v1/metrics', {
        data: {
            resourceMetrics: [
                {
                    resource: {
                        attributes: [
                            { key: 'service.name', value: { stringValue: 'design-units' } },
                        ],
                    },
                    scopeMetrics: [
                        {
                            metrics: [
                                {
                                    name,
                                    unit: 'ms',
                                    gauge: {
                                        dataPoints: [
                                            {
                                                timeUnixNano: String(BigInt(Date.now()) * 1000000n),
                                                asDouble: 12.5,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    })
    await page.goto('/#metrics')
    await page.getByTestId('metrics-service-filter').selectOption('design-units')
    const card = page.locator('.metric-card').filter({ hasText: name })
    await expect(card.locator('.metric-card-value')).toHaveText('12.5 ms')
    await expect(card).toContainText('Average')
    await card.getByRole('button', { name: 'View measurements' }).click()
    await expect(page.locator('.metric-row')).toHaveCount(1)
    await expect(page.locator('.metric-row')).toContainText('12.5 ms')
    await expect(page.locator('.metric-row')).not.toHaveAttribute('tabindex')
    const data = await (await request.get(`/api/metrics?aggregation=summary&name=${name}`)).json()
    expect(data.summary[0].unit).toBe('ms')
    expect(data.summary[0].avg_value).toBe(12.5)
})

for (const width of [1440, 1280, 800, 390]) {
    test(`investigation layouts fit ${width}px and keep selected details readable`, async ({
        page,
        request,
    }) => {
        const ids = await seed(request)
        await page.setViewportSize({ width, height: 900 })
        fs.mkdirSync(evidence, { recursive: true })
        for (const tab of ['traces', 'logs', 'timeline', 'sessions']) {
            await page.goto(`/#${tab}`)
            if (tab === 'sessions') {
                await page.getByRole('textbox', { name: 'Search sessions' }).fill(ids.session)
                await page.getByRole('button', { name: ids.session, exact: true }).click()
                await expect(page.locator('.session-detail')).toContainText(
                    'Design investigation root',
                )
            } else {
                const search = page.getByTestId(`${tab}-search`)
                const filtered = page.waitForResponse(
                    (r) =>
                        new URL(r.url()).pathname === `/api/${tab}` &&
                        new URL(r.url()).searchParams.has('q'),
                )
                await search.fill(tab === 'traces' ? 'Design investigation root' : ids.key)
                await filtered
                const row = page
                    .locator(
                        tab === 'traces'
                            ? `[data-trace-id="${ids.root}"]`
                            : tab === 'logs'
                              ? '[data-testid="log-row"]'
                              : '.timeline-item',
                    )
                    .first()
                await expect(row).toBeVisible()
                if (tab !== 'timeline')
                    await expect(page.getByTestId(`${tab}-detail-panel`)).toHaveCount(0)
                for (const theme of ['light', 'dark']) {
                    await page.evaluate(
                        (theme) => document.documentElement.setAttribute('data-theme', theme),
                        theme,
                    )
                    await page.screenshot({
                        animations: 'disabled',
                        path: path.join(evidence, `${tab}-${width}-${theme}-list.png`),
                    })
                }
                await row.click()
                await expect(page.getByTestId(`${tab}-detail-panel`)).toBeVisible()
                if (width <= 800)
                    await expect(page.locator('.tab-content.active .panel-left')).toBeHidden()
                await page.getByRole('button', { name: 'Back to list', exact: false }).click()
                await expect(row).toBeVisible()
                await expect(search).not.toHaveValue('')
                await row.click()
                const panel = page.getByTestId(`${tab}-detail-panel`)
                if (tab === 'traces')
                    await expect(panel.locator('.detail-panel .name')).toHaveText(
                        'Design investigation root',
                    )
                else await expect(panel.getByTestId('log-body')).toContainText(ids.key)
            }
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true)
            for (const theme of ['light', 'dark']) {
                await page.evaluate((theme) => {
                    document.documentElement.setAttribute('data-theme', theme)
                }, theme)
                await page.screenshot({
                    animations: 'disabled',
                    path: path.join(evidence, `${tab}-${width}-${theme}.png`),
                })
            }
        }
    })
}

test('analytics exposes exact daily values newest first with matching date labels', async ({
    page,
    request,
}) => {
    const data = await (await request.get('/api/analytics?days=7')).json()
    await page.goto('/#analytics')
    await page.getByTestId('analytics-days-filter').selectOption('7')
    const latest = data.daily.at(-1)
    const row = page.getByTestId('daily-summary-table').locator('tbody tr').first()
    await expect(row.locator('td').first()).toHaveText(latest.date)
    await expect(row.locator('td').nth(2)).toHaveText(latest.tokens.toLocaleString())
    await expect(page.locator('.chart-dates')).toContainText(data.daily[0].date)
    await expect(page.getByTestId('cost-by-tool-card')).toContainText('Service / Provider')
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        )
        await page.screenshot({
            animations: 'disabled',
            path: path.join(evidence, `analytics-${width}.png`),
        })
    }
})

test('session search covers older pages and Clear restores the complete result set', async ({
    page,
    request,
}) => {
    const prefix = `design-search-${crypto.randomUUID()}`
    for (let i = 0; i < 52; i++)
        await request.post('/api/spans', {
            data: {
                id: crypto.randomUUID(),
                session_id: `${prefix}-${i}`,
                span_name: i === 0 ? `${prefix}-needle` : 'Other workflow',
                start_time: Date.now() - (52 - i) * 1000,
            },
        })
    const filtered = await (await request.get(`/api/sessions?q=${prefix}-needle`)).json()
    expect(filtered.total).toBe(1)
    expect(filtered.sessions[0].session_id).toBe(`${prefix}-0`)
    await page.goto('/#sessions')
    const search = page.getByRole('textbox', { name: 'Search sessions' })
    await search.fill(prefix)
    await expect(page.getByRole('navigation', { name: 'Session pages' })).toContainText('of 52')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('navigation', { name: 'Session pages' })).toContainText(
        '51–52 of 52',
    )
    await search.fill(`${prefix}-needle`)
    await expect(page.locator('.sessions-table tbody tr')).toHaveCount(1)
    await expect(page.getByRole('button', { name: `${prefix}-0`, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
    await expect(search).toHaveValue('')
    await expect(page.locator('.sessions-table tbody tr')).toHaveCount(50)
})

test('loading is distinct from empty data and an obsolete failure cannot replace newer models', async ({
    page,
}) => {
    let release
    const gate = new Promise((resolve) => {
        release = resolve
    })
    let count = 0
    await page.route('**/api/models?**', async (route) => {
        if (++count === 1) {
            await gate
            await route.fulfill({ status: 503, json: { error: 'Old failure' } })
        } else
            await route.fulfill({
                json: [
                    {
                        model: 'Newest result',
                        request_count: 1,
                        total_tokens: 0,
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_cost: 0,
                        avg_latency: null,
                    },
                ],
            })
    })
    await page.goto('/#models')
    await expect(page.locator('.tab-content.active').getByRole('status')).toHaveText('Loading…')
    await expect(page.locator('.tab-content.active .empty-state')).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Model time range' }).selectOption('7')
    await expect(page.locator('.model-card')).toContainText('Newest result')
    release()
    await expect(page.locator('.tab-content.active').getByRole('alert')).toHaveCount(0)
    await expect(page.locator('.model-card')).toContainText('Newest result')
})

test('uncorrelated and evicted logs explain missing navigation, structured bodies remain readable', async ({
    page,
    request,
}) => {
    const key = `design-log-${crypto.randomUUID()}`
    await request.post('/v1/logs', {
        data: {
            resourceLogs: [
                {
                    scopeLogs: [
                        {
                            logRecords: [
                                { body: { stringValue: key }, severityNumber: 9 },
                                {
                                    body: {
                                        kvlistValue: {
                                            values: [
                                                {
                                                    key: 'message',
                                                    value: { stringValue: key + '-structured' },
                                                },
                                            ],
                                        },
                                    },
                                    traceId: 'a'.repeat(32),
                                    spanId: 'b'.repeat(16),
                                    severityNumber: 17,
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    })
    await page.goto('/#logs')
    await page.getByTestId('logs-search').fill(key)
    await page.getByTestId('log-row').filter({ hasText: '-structured' }).click()
    await expect(page.getByTestId('logs-detail-panel')).toContainText(
        'No captured spans for this trace',
    )
    await expect(page.getByRole('button', { name: 'Open trace', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Back to list', exact: false }).click()
    await page
        .getByTestId('log-row')
        .filter({ hasText: key })
        .filter({ hasNotText: '-structured' })
        .click()
    await expect(page.getByTestId('logs-detail-panel')).toContainText(
        'No trace correlation captured',
    )
    await expect(page.getByRole('button', { name: 'Open trace', exact: true })).toHaveCount(0)
})

test('closing a resized inspector restores full-width list and its scroll position', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await page.goto('/#traces')
    const list = page.locator('.tab-content.active .panel-left')
    await expect(page.getByTestId('trace-row').first()).toBeVisible()
    await list.evaluate((el) => {
        el.scrollTop = 150
    })
    const before = await list.evaluate((el) => el.scrollTop)
    await page.getByTestId('trace-row').nth(6).click()
    await expect(
        page.getByTestId('traces-detail-panel').locator('.detail-panel .name'),
    ).toBeVisible()
    await list.evaluate((el) => {
        el.style.width = '370px'
    })
    await page.getByRole('button', { name: 'Back to list', exact: false }).click()
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(before)
    expect(await list.evaluate((el) => el.clientWidth)).toBeGreaterThan(1100)
    await page.getByTestId('trace-row').nth(6).click()
    expect(await list.evaluate((el) => el.getBoundingClientRect().width)).toBe(370)
})

test('empty datasets hide headers and paging and filtered emptiness offers recovery', async ({
    page,
}) => {
    await page.route('**/api/sessions?**', (route) =>
        route.fulfill({ json: { sessions: [], total: 0 } }),
    )
    await page.goto('/#sessions')
    await expect(page.locator('.sessions-tab')).toContainText('session.id')
    await expect(page.locator('.sessions-table')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Session pages' })).toHaveCount(0)
    await page.route('**/api/traces?**', (route) => route.fulfill({ json: [] }))
    await page.getByTestId('tab-traces').click()
    await expect(page.locator('.tab-content.active')).toContainText(
        'Send requests through the proxy',
    )
    await expect(page.getByTestId('traces-table')).toHaveCount(0)
    await page.getByTestId('traces-search').fill('nothing')
    await expect(page.locator('.tab-content.active')).toContainText(
        'No results match these filters',
    )
    await page.getByTestId('traces-clear-filters').click()
    await expect(page.getByTestId('traces-search')).toHaveValue('')
    await expect(page.getByTestId('traces-detail-panel')).toHaveCount(0)
})

test('Timeline distinguishes identical events by body and contains long or missing messages', async ({
    page,
    request,
}) => {
    const service = `design-preview-${crypto.randomUUID()}`
    await request.post('/v1/logs', {
        data: {
            resourceLogs: [
                {
                    resource: {
                        attributes: [{ key: 'service.name', value: { stringValue: service } }],
                    },
                    scopeLogs: [
                        {
                            logRecords: [
                                {
                                    body: { stringValue: 'First useful message' },
                                    attributes: [
                                        {
                                            key: 'event.name',
                                            value: { stringValue: 'shared.event' },
                                        },
                                    ],
                                    severityNumber: 9,
                                },
                                {
                                    body: {
                                        stringValue:
                                            'Second useful message ' + 'long '.repeat(1000),
                                    },
                                    attributes: [
                                        {
                                            key: 'event.name',
                                            value: { stringValue: 'shared.event' },
                                        },
                                    ],
                                    severityNumber: 17,
                                },
                                {
                                    attributes: [
                                        {
                                            key: 'event.name',
                                            value: { stringValue: 'missing.body' },
                                        },
                                    ],
                                    severityNumber: 9,
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    })
    await page.goto('/#timeline')
    await page.getByRole('combobox', { name: 'Service', exact: true }).selectOption(service)
    await expect(page.locator('.timeline-item')).toHaveCount(3)
    await expect(
        page.locator('.timeline-item-title').filter({ hasText: 'First useful message' }),
    ).toBeVisible()
    const long = page.locator('.timeline-item').filter({ hasText: 'Second useful message' })
    await expect(long.locator('.timeline-item-subtitle')).toHaveText('shared.event')
    await expect(long.locator('.service-badge')).toHaveCount(1)
    expect(
        await long
            .locator('.timeline-item-title')
            .evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThan(60)
    await expect(
        page.locator('.timeline-item-title').filter({ hasText: 'missing.body' }),
    ).toBeVisible()
})

test('explicit populated detail tab remains selected when moving between spans', async ({
    page,
    request,
}) => {
    const ids = await seed(request)
    await request.post('/api/spans', {
        data: {
            id: `sibling-${ids.root}`,
            parent_id: ids.root,
            trace_id: ids.trace,
            span_name: 'Second output span',
            output: { text: 'Another output' },
            input: { text: 'Another input' },
        },
    })
    await page.goto('/#traces')
    await page.locator(`[data-trace-id="${ids.child}"]`).click()
    const panel = page.getByTestId('traces-detail-panel')
    await panel.getByRole('button', { name: 'output', exact: true }).click()
    await panel.getByRole('treeitem', { name: 'Second output span', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'output', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
    )
    await expect(panel.locator('.detail-panel .body')).toContainText('Another output')
})
