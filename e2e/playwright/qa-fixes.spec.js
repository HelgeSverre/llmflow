const { test, expect } = require('@playwright/test')

async function sendLog(request, service, body, severity = 17) {
    const response = await request.post('/v1/logs', {
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
                                    timeUnixNano: String(BigInt(Date.now()) * 1000000n),
                                    severityNumber: severity,
                                    severityText: severity === 17 ? 'ERROR' : 'DEBUG',
                                    body: { stringValue: body },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    })
    expect(response.ok()).toBe(true)
}

async function sendSpan(request, data) {
    const response = await request.post('/api/spans', { data: { duration_ms: 10, ...data } })
    expect(response.ok()).toBe(true)
}

test('live logs keep severity labels and apply server search to untruncated bodies', async ({
    page,
    request,
}) => {
    const service = `qa-logs-${crypto.randomUUID()}`
    await page.goto('/#timeline')
    await expect(page.getByRole('button', { name: 'Logs', exact: true })).toBeVisible()
    await sendLog(request, service, 'initial error')
    await page.getByRole('button', { name: 'Logs', exact: true }).click()
    await page.getByTestId('logs-service-filter').selectOption(service)
    await page.getByTestId('logs-severity-filter').selectOption('17')
    await expect(page.getByTestId('logs-severity-filter')).toHaveValue('17')
    await expect(page.getByRole('button', { name: /initial error/ })).toBeVisible()
    await sendLog(request, service, 'low severity must stay hidden', 5)
    await sendLog(request, service, 'second error')
    await expect(page.getByRole('button', { name: /second error/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /low severity must stay hidden/ })).toHaveCount(0)
    const marker = `search-${crypto.randomUUID()}`
    await page.getByTestId('logs-search').fill(marker)
    await expect(page.getByRole('button', { name: /second error/ })).toHaveCount(0)
    await sendLog(request, service, `${'x'.repeat(250)} ${marker}`)
    await expect(page.getByRole('button', { name: new RegExp(marker) })).toBeVisible()
    await expect(page.getByTestId('logs-severity-filter')).toHaveValue('17')
    await page.getByTestId('logs-clear-filters').click()
    await expect(page.getByTestId('logs-severity-filter')).toHaveValue('')
})

test('sessions refresh on activation and live updates include selected-session descendants', async ({
    page,
    request,
}) => {
    const session = `qa-session-${crypto.randomUUID()}`
    const id = crypto.randomUUID()
    await page.goto('/#sessions')
    await expect(page.getByRole('textbox', { name: 'Search sessions' })).toBeVisible()
    await page.getByRole('button', { name: 'Timeline', exact: true }).click()
    await sendSpan(request, {
        id,
        trace_id: id,
        span_name: 'Session QA root',
        session_id: session,
        total_tokens: 5,
    })
    await page.getByRole('button', { name: 'Sessions', exact: true }).click()
    await expect(page.getByText(session, { exact: true })).toBeVisible()
    const liveSession = `qa-live-${crypto.randomUUID()}`
    await sendSpan(request, { id: crypto.randomUUID(), session_id: liveSession })
    await expect(page.getByText(liveSession, { exact: true })).toBeVisible()
    await page.getByText(session, { exact: true }).click()
    await expect(page.locator('.session-detail .summary')).toContainText('1 span')
    await sendSpan(request, {
        id: crypto.randomUUID(),
        trace_id: id,
        parent_id: id,
        span_name: 'Session QA child',
        total_tokens: 7,
    })
    await expect(page.locator('.session-detail .summary')).toContainText('2 spans')
    await expect(page.locator('.session-detail .summary')).toContainText('12 tokens')
})

test('trace search finds names and body text while keeping model filters', async ({
    page,
    request,
}) => {
    const marker = `qa-name-${crypto.randomUUID()}`
    const input = `qa-input-${crypto.randomUUID()}`
    const model = `qa-model-${crypto.randomUUID()}`
    await sendSpan(request, {
        id: crypto.randomUUID(),
        span_name: marker,
        model,
        input: { text: input },
    })
    await sendSpan(request, {
        id: crypto.randomUUID(),
        span_name: marker + '-other',
        model: model + '-other',
    })
    await page.goto('/#traces')
    await page.getByTestId('traces-model-filter').selectOption(model)
    await page.getByTestId('traces-search').fill(marker)
    await expect(page.getByTestId('trace-row')).toHaveCount(1)
    await expect(page.getByTestId('trace-row')).toContainText(marker)
    await page.getByTestId('traces-search').fill(input)
    await expect(page.getByTestId('trace-row')).toHaveCount(1)
    await expect(page.getByTestId('trace-row')).toContainText(marker)
})

test('Timeline details show failed requests and Retry recovers without stale errors', async ({
    page,
    request,
}) => {
    const id = crypto.randomUUID(),
        name = `qa-detail-${id}`
    const otherId = crypto.randomUUID(),
        otherName = `qa-other-${otherId}`
    await sendSpan(request, { id, span_name: name, input: { text: 'retry success' } })
    await sendSpan(request, { id: otherId, span_name: otherName })
    await page.goto('/#timeline')
    await page.route(`**/api/traces/${id}`, (route) => route.abort())
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await expect(page.getByRole('alert')).toHaveText('Could not load details.')
    await expect(page.getByText('Loading details…')).toHaveCount(0)
    await page.unroute(`**/api/traces/${id}`)
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByRole('button', { name: 'input', exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    let release
    const gate = new Promise((resolve) => {
        release = resolve
    })
    await page.route(`**/api/traces/${id}`, async (route) => {
        await gate
        await route.abort()
    })
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await page.getByRole('button', { name: new RegExp(otherName) }).click()
    await expect(page.getByTestId('timeline-detail-title')).toHaveText(otherName)
    await expect(page.getByRole('button', { name: 'attributes', exact: true })).toBeVisible()
    release()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('alert')).toHaveCount(0)
})
