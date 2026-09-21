const { test, expect } = require('@playwright/test')

test('metric rows and cards display measured integers, decimals, histograms and zeros', async ({
    page,
    request,
}, testInfo) => {
    const prefix = `ui-contract-${crypto.randomUUID()}`
    const time = String(BigInt(Date.now()) * 1000000n)
    const points = (value) =>
        Array.from({ length: 20 }, (_, i) => ({ timeUnixNano: time, ...value(i) }))
    const result = await request.post('/v1/metrics', {
        data: {
            resourceMetrics: [
                {
                    resource: {
                        attributes: [{ key: 'service.name', value: { stringValue: prefix } }],
                    },
                    scopeMetrics: [
                        {
                            metrics: [
                                {
                                    name: prefix + '-counter',
                                    sum: {
                                        dataPoints: points((i) => ({
                                            asInt: i < 10 ? '900' : '100',
                                        })),
                                    },
                                },
                                {
                                    name: prefix + '-gauge',
                                    gauge: {
                                        dataPoints: points((i) => ({
                                            asDouble: i % 2 ? 3.5 : 2.5,
                                        })),
                                    },
                                },
                                {
                                    name: prefix + '-zero',
                                    gauge: { dataPoints: points(() => ({ asInt: '0' })) },
                                },
                                {
                                    name: prefix + '-histogram',
                                    histogram: {
                                        dataPoints: points(() => ({
                                            count: '3',
                                            sum: 6,
                                            bucketCounts: ['1', '2'],
                                            explicitBounds: [1],
                                        })),
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    })
    expect(result.ok()).toBeTruthy()
    await page.goto('/#metrics')
    await page.getByTestId('metrics-service-filter').selectOption(prefix)
    const rows = page.locator('[data-testid="metrics-body"] tr')
    await expect(rows).toHaveCount(80)
    for (const [suffix, expected] of [
        ['zero', /^0$/],
        ['gauge', /^(2\.5|3\.5)$/],
        ['counter', /^(100|900)$/],
        ['histogram', /^count: 3 · sum: 6$/],
    ]) {
        const values = rows.filter({ hasText: `${prefix}-${suffix}` }).locator('.metric-value')
        await expect(values).toHaveCount(20)
        for (const value of await values.all()) await expect(value).toHaveText(expected)
    }
    const cards = page.locator('.metric-card')
    for (const [suffix, expected] of [
        ['counter', '10,000'],
        ['gauge', '3'],
        ['zero', '0'],
        ['histogram', '60'],
    ]) {
        await expect(
            cards.filter({ hasText: prefix + '-' + suffix }).locator('.metric-card-value'),
        ).toHaveText(expected)
    }
    await page.screenshot({ path: testInfo.outputPath('metrics-measured-values.png') })
})

test('keyboard shortcuts refresh the active tab and reach all seven tabs', async ({ page }) => {
    const tabs = [
        ['timeline', '/api/timeline?'],
        ['traces', '/api/traces?'],
        ['sessions', '/api/sessions?'],
        ['logs', '/api/logs?'],
        ['metrics', '/api/metrics?'],
        ['models', '/api/models'],
        ['analytics', '/api/analytics?'],
    ]
    await page.goto('/#timeline')
    for (const [index, [tab, endpoint]] of tabs.entries()) {
        await page.keyboard.press(String(index + 1))
        await expect(page.getByTestId('tab-' + tab)).toHaveClass(/active/)
        // Wait for initial loading before checking the refresh trigger.
        await page.waitForLoadState('networkidle')
        const refreshed = page.waitForResponse(
            (response) => response.url().includes(endpoint) && response.status() === 200,
        )
        await page.keyboard.press('r')
        await refreshed
    }
    await page.keyboard.press('2')
    await page.keyboard.press('/')
    const input = page.getByTestId('traces-search')
    await expect(input).toBeFocused()
    await page.keyboard.type('r7')
    await expect(input).toHaveValue('r7')
    await expect(page.getByTestId('tab-traces')).toHaveClass(/active/)
    await page.keyboard.press('Escape')
    const prevented = await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', {
            key: 'r',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        })
        window.dispatchEvent(event)
        return event.defaultPrevented
    })
    expect(prevented).toBe(false)
    await page.getByTestId('tab-timeline').click()
    await expect(page.locator('[data-testid="timeline-type-filter"] option')).toHaveText([
        'All Types',
        'Traces',
        'Logs',
    ])
})

test('unknown and zero span durations remain distinct in the table, tree and detail', async ({
    page,
    request,
}) => {
    const prefix = `duration-${crypto.randomUUID()}`
    for (const duration of [null, 0]) {
        const response = await request.post('/api/spans', {
            data: {
                id: prefix + duration,
                span_name: prefix + duration,
                model: prefix,
                span_type: 'llm',
                duration_ms: duration,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                estimated_cost: 0,
            },
        })
        expect(response.ok()).toBeTruthy()
    }
    await page.goto('/#traces')
    await page.getByTestId('traces-model-filter').selectOption(prefix)
    for (const [duration, label] of [
        [null, '-'],
        [0, '0ms'],
    ]) {
        const row = page.locator(`[data-trace-id="${prefix + duration}"]`)
        await expect(row.getByTestId('trace-latency')).toHaveText(label)
        await expect(row.getByTestId('trace-tokens')).toHaveText('0')
        await expect(row.getByTestId('trace-cost')).toHaveText('$0.00')
        await row.click()
        const span = page.getByRole('treeitem', { name: prefix + duration, exact: true })
        await expect(span.locator('.duration-col')).toHaveText(label)
        await span.click()
        await expect(page.locator('.detail-panel .meta')).toContainText(label)
        if (duration === null)
            await expect(page.locator('.detail-panel .meta')).not.toContainText('0ms')
    }
})
