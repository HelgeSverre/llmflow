const { test, expect } = require('@playwright/test')

test('Analytics renders nonzero daily data and service costs without page errors', async ({
    page,
    request,
}) => {
    const name = `analytics-${crypto.randomUUID()}`
    await request.post('/api/spans', {
        data: {
            id: name,
            span_name: name,
            service_name: name,
            model: name,
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
            estimated_cost: 0.25,
            duration_ms: 10,
        },
    })
    const data = await (await request.get('/api/analytics?days=7')).json()
    const today = data.daily.find((row) => row.date === new Date().toISOString().slice(0, 10))
    expect(today.tokens).toBeGreaterThanOrEqual(150)
    expect(today.prompt_tokens).toBeGreaterThanOrEqual(100)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/#analytics')
    await page.getByTestId('analytics-days-filter').selectOption('7')
    const service = page
        .getByTestId('cost-by-tool-chart')
        .locator('.h-bar-row')
        .filter({ hasText: name })
    await expect(service.locator('.h-bar-value')).toHaveText('$0.25')
    const row = page
        .getByTestId('daily-summary-table')
        .locator('tbody tr')
        .filter({ hasText: today.date })
    await expect(row.locator('td').nth(1)).toHaveText(String(today.requests))
    await expect(row.locator('td').nth(2)).not.toHaveText('-')
    await expect(row.locator('td').nth(3)).not.toHaveText('-')
    await expect
        .poll(() =>
            page
                .getByTestId('token-trends-chart')
                .locator('.bar-total')
                .evaluateAll((bars) => bars.some((bar) => bar.getBoundingClientRect().height > 0)),
        )
        .toBe(true)
    expect(errors).toEqual([])
})

test('Sessions opens the selected root span using canonical tab navigation', async ({
    page,
    request,
}) => {
    const id = `span-${crypto.randomUUID()}`,
        session = `session-${crypto.randomUUID()}`
    const response = await request.post('/api/spans', {
        data: {
            id,
            trace_id: `trace-${id}`,
            session_id: session,
            span_name: 'Session navigation fixture',
            duration_ms: 10,
            input: { text: 'session input' },
        },
    })
    expect(response.ok()).toBe(true)
    await page.goto('/#sessions')
    await page.locator('.sessions-table tr').filter({ hasText: session }).click()
    await page.locator('.session-detail .trace-list button').first().click()
    await expect(page).toHaveURL(/#traces$/)
    await expect(page.getByTestId('tab-traces')).toHaveClass(/active/)
    await expect(
        page.getByRole('treeitem', { name: 'Session navigation fixture', exact: true }),
    ).toBeVisible()
})

test('Metrics filters affect cards and rows and live gauges preserve correct averages', async ({
    page,
    request,
}) => {
    const service = `metrics-${crypto.randomUUID()}`
    const timeUnixNano = String(BigInt(Date.now()) * 1000000n)
    const send = async (serviceName, metrics) => {
        const response = await request.post('/v1/metrics', {
            data: {
                resourceMetrics: [
                    {
                        resource: {
                            attributes: [
                                { key: 'service.name', value: { stringValue: serviceName } },
                            ],
                        },
                        scopeMetrics: [{ metrics }],
                    },
                ],
            },
        })
        expect(response.ok()).toBe(true)
    }
    const metrics = ['integer', 'double', 'mixed'].map((name, index) => ({
        name: `${service}-${name}`,
        gauge: {
            dataPoints: [
                { timeUnixNano, ...(index === 1 ? { asDouble: 10 } : { asInt: '10' }) },
                { timeUnixNano, ...(index === 0 ? { asInt: '20' } : { asDouble: 20 }) },
            ],
        },
    }))
    metrics.push({
        name: `${service}-counter`,
        sum: { dataPoints: [{ timeUnixNano, asInt: '99' }] },
    })
    await send(service, metrics)
    await page.goto('/#metrics')
    await page.getByTestId('metrics-service-filter').selectOption(service)
    await page.getByTestId('metrics-type-filter').selectOption('gauge')
    await expect(page.locator('.metric-card')).toHaveCount(3)
    await expect(page.locator('.metric-card-value')).toHaveText(['15', '15', '15'])
    await expect(page.getByTestId('metrics-body').locator('tr')).toHaveCount(6)
    await send('other-service', [
        { name: 'unrelated', gauge: { dataPoints: [{ timeUnixNano, asInt: '99' }] } },
    ])
    await send(service, [
        { name: `${service}-live`, gauge: { dataPoints: [{ timeUnixNano, asInt: '0' }] } },
    ])
    await expect(
        page
            .getByTestId('metrics-body')
            .locator('tr')
            .filter({ hasText: `${service}-live` })
            .locator('.metric-value'),
    ).toHaveText('0')
    await expect(page.locator('.metric-card')).toHaveCount(4)
    await expect(
        page
            .locator('.metric-card')
            .filter({ hasText: `${service}-live` })
            .locator('.metric-card-value'),
    ).toHaveText('0')
    await page.getByTestId('metrics-name-filter').selectOption(`${service}-counter`)
    await expect(page.locator('.metric-card')).toHaveCount(0)
    await expect(page.getByTestId('metrics-body')).toContainText('No metrics found')
    await page.getByTestId('metrics-clear-filters').click()
    await expect(page.locator('.metric-card').first()).toBeVisible()
})

test('Header displays actual zero stats rather than missing-value dashes', async ({ page }) => {
    await page.route('**/api/stats', (route) =>
        route.fulfill({
            json: { total_requests: 1, total_tokens: 0, total_cost: 0, avg_duration: 0 },
        }),
    )
    await page.goto('/')
    await expect(page.getByTestId('total-requests')).toHaveText('1')
    await expect(page.getByTestId('total-tokens')).toHaveText('0')
    await expect(page.getByTestId('total-cost')).toHaveText('$0.00')
    await expect(page.getByTestId('avg-latency')).toHaveText('0ms')
})

test('Timeline correlates real trace IDs, filters custom services, and renders messages and linked logs', async ({
    page,
    request,
}) => {
    const service = `custom-${crypto.randomUUID()}`,
        id = crypto.randomUUID().replaceAll('-', '').slice(0, 16),
        traceId = crypto.randomUUID().replaceAll('-', '')
    await request.post('/api/spans', {
        data: {
            id,
            trace_id: traceId,
            service_name: service,
            span_name: 'Readable conversation',
            duration_ms: 0,
            input: [{ role: 'user', parts: [{ type: 'text', content: 'Hello from the input' }] }],
            output: [
                {
                    role: 'assistant',
                    parts: [
                        { type: 'tool_call', name: 'weather', arguments: { city: 'Oslo' } },
                        { type: 'tool_call_response', response: { temperature: 12 } },
                    ],
                },
            ],
        },
    })
    const timeUnixNano = String(BigInt(Date.now()) * 1000000n)
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
                                    timeUnixNano,
                                    traceId,
                                    spanId: id,
                                    severityText: 'INFO',
                                    body: { stringValue: 'Correlated timeline log' },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    })
    await request.post('/api/spans', {
        data: {
            id: crypto.randomUUID(),
            service_name: service + '-other',
            span_name: 'Excluded service',
        },
    })
    await page.goto('/#timeline')
    await page.getByTestId('timeline-tool-filter').fill(service)
    await expect(page.locator('.timeline-item')).toHaveCount(2)
    await page.locator('.timeline-item').filter({ hasText: 'Readable conversation' }).click()
    await expect(page.getByTestId('related-logs')).toContainText('Correlated timeline log')
    const detail = page.getByTestId('timeline-detail-panel')
    await detail.getByRole('button', { name: 'input', exact: true }).click()
    await expect(detail.locator('.messages article')).toContainText('user')
    await expect(detail.locator('.messages')).toContainText('Hello from the input')
    await detail.getByRole('button', { name: 'output', exact: true }).click()
    await expect(detail.locator('.messages')).toContainText('Tool call: weather')
    await expect(detail.locator('.messages')).toContainText('"temperature": 12')
    await page.screenshot({
        path: '.backlog/assets/images/fixed-timeline-conversation.png',
        fullPage: true,
    })
    await page.locator('.timeline-item').filter({ hasText: 'Correlated timeline log' }).click()
    await expect(detail.getByTestId('log-body')).toHaveText('Correlated timeline log')
    await detail.getByRole('button', { name: `Open trace ${traceId}` }).click()
    await expect(page).toHaveURL(/#traces$/)
    await expect(
        page.getByRole('treeitem', { name: 'Readable conversation', exact: true }),
    ).toBeVisible()
    await page.getByTestId('tab-timeline').click()
    await page.getByTestId('timeline-clear-filters').click()
    await expect(
        page.locator('.timeline-item').filter({ hasText: 'Excluded service' }),
    ).toBeVisible()
})

test('Sessions can open an older session beyond the first fifty', async ({ page, request }) => {
    const prefix = `paging-${crypto.randomUUID()}`
    for (let i = 0; i < 52; i++) {
        await request.post('/api/spans', {
            data: {
                id: `${prefix}-span-${i}`,
                start_time: Date.now() - 365 * 86400000 + i,
                session_id: `${prefix}-session-${i}`,
                span_name: `${prefix}-name-${i}`,
            },
        })
    }
    const first = await (await request.get('/api/sessions?limit=50')).json()
    const next = await (await request.get('/api/sessions?limit=50&offset=50')).json()
    expect(next.sessions.length).toBeGreaterThan(0)
    const target = next.sessions[0].session_id
    await page.goto('/#sessions')
    await expect(page.locator('.sessions-table tbody tr')).toHaveCount(50)
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.locator('.sessions-table tbody tr')).toHaveCount(next.sessions.length)
    const ids = await page.locator('.sessions-table tbody .mono').allTextContents()
    expect(ids).toEqual(next.sessions.map((row) => row.session_id))
    expect(ids.some((id) => first.sessions.some((row) => row.session_id === id))).toBe(false)
    await page.screenshot({
        path: '.backlog/assets/images/fixed-session-pagination.png',
        fullPage: true,
    })
    await page.locator('.sessions-table tr').filter({ hasText: target }).click()
    await expect(page.locator('.session-detail')).toContainText(target)
})

test('Replay opens a separate streaming trace from the local provider fixture', async ({
    page,
    request,
}) => {
    const before = await (await request.get('/api/traces/replay-browser-fixture')).json()
    await page.goto('/#traces')
    await page.getByTestId('traces-search').fill('replay browser request')
    await page
        .getByTestId('traces-body')
        .locator('tr')
        .filter({ hasText: 'replay-fixture' })
        .click()
    const resultResponse = page.waitForResponse(
        (response) => response.url().endsWith('/replay') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Replay request', exact: true }).click()
    const result = await (await resultResponse).json()
    expect(result.id).not.toBe('replay-browser-fixture')
    await expect(
        page.getByRole('treeitem', { name: 'ollama replay-fixture', exact: true }),
    ).toBeVisible()
    await page.getByRole('treeitem', { name: 'ollama replay-fixture', exact: true }).click()
    await page
        .getByTestId('traces-detail-panel')
        .getByRole('button', { name: 'response', exact: true })
        .click()
    await expect(page.getByTestId('traces-detail-panel')).toContainText('Local replay result')
    expect(await (await request.get('/api/traces/replay-browser-fixture')).json()).toEqual(before)
    await page.screenshot({
        path: '.backlog/assets/images/fixed-replay-result.png',
        fullPage: true,
    })
})
