const { test, expect } = require('@playwright/test')

async function seedTree(request) {
    const traceId = crypto.randomUUID().replaceAll('-', '')
    const ids = Array.from({ length: 4 }, () =>
        crypto.randomUUID().replaceAll('-', '').slice(0, 16),
    )
    const now = Date.now()
    const names = ['Research workflow', 'Research agent', 'Answer with context', 'Independent tool']
    const response = await request.post('/v1/traces', {
        data: {
            resourceSpans: [
                {
                    resource: {
                        attributes: [{ key: 'service.name', value: { stringValue: 'review-e2e' } }],
                    },
                    scopeSpans: [
                        {
                            spans: ids.map((id, i) => ({
                                traceId,
                                spanId: id,
                                parentSpanId: i === 1 ? ids[0] : i === 2 ? ids[1] : undefined,
                                name: names[i],
                                startTimeUnixNano: String(
                                    BigInt(now + [0, 100, 200, 850][i]) * 1000000n,
                                ),
                                endTimeUnixNano: String(
                                    BigInt(now + [1000, 800, 500, 950][i]) * 1000000n,
                                ),
                                attributes: [
                                    {
                                        key: 'gen_ai.operation.name',
                                        value: {
                                            stringValue: [
                                                'invoke_workflow',
                                                'invoke_agent',
                                                'chat',
                                                'execute_tool',
                                            ][i],
                                        },
                                    },
                                    {
                                        key: 'gen_ai.input.messages',
                                        value: {
                                            stringValue: JSON.stringify([
                                                {
                                                    role: 'user',
                                                    parts: [
                                                        {
                                                            type: 'text',
                                                            content:
                                                                'Explain the evidence.\n'.repeat(
                                                                    100,
                                                                ),
                                                        },
                                                    ],
                                                },
                                            ]),
                                        },
                                    },
                                    {
                                        key: 'gen_ai.usage.input_tokens',
                                        value: { intValue: '1000' },
                                    },
                                    {
                                        key: 'gen_ai.usage.output_tokens',
                                        value: { intValue: '25' },
                                    },
                                    {
                                        key: 'gen_ai.request.model',
                                        value: { stringValue: 'gpt-4o-mini' },
                                    },
                                ],
                            })),
                        },
                    ],
                },
            ],
        },
    })
    expect(response.ok()).toBeTruthy()
    return { ids, names }
}

for (const width of [1440, 1000, 390]) {
    test(`nested tree, timing and bounded detail at ${width}px`, async ({
        page,
        request,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        const { ids, names } = await seedTree(request)
        await page.goto('/#traces')
        await page.locator(`[data-trace-id="${ids[0]}"]`).click()
        const panel = page.getByTestId('traces-detail-panel')
        await expect(panel.getByRole('treeitem')).toHaveCount(4)
        for (const name of names)
            await expect(panel.getByRole('treeitem', { name, exact: true })).toBeVisible()

        await expect(async () => {
            const geometry = await panel.evaluate((el) => {
                const axis = el.querySelector('.axis-bar-area').getBoundingClientRect()
                const root = el.querySelector('.span-bar').getBoundingClientRect()
                return { axis: axis.width, root: root.width, offset: root.x - axis.x }
            })
            expect(geometry.axis).toBeGreaterThan(30)
            expect(Math.abs(geometry.axis - geometry.root)).toBeLessThan(1)
            expect(Math.abs(geometry.offset)).toBeLessThan(1)
        }).toPass()
        await panel.getByRole('treeitem', { name: names[2], exact: true }).click()
        await expect(panel.locator('.detail-panel .name')).toHaveText(names[2])
        await panel.getByRole('button', { name: 'input', exact: true }).click()
        await expect(panel.locator('.detail-panel .body')).toContainText('Explain the evidence.')
        await expect(async () => {
            const bounds = await page.evaluate(() => ({
                width: document.documentElement.scrollWidth,
                height: document.documentElement.scrollHeight,
                viewport: { width: innerWidth, height: innerHeight },
                bottom: document.querySelector('.detail-panel').getBoundingClientRect().bottom,
            }))
            expect(bounds.width).toBeLessThanOrEqual(bounds.viewport.width)
            expect(bounds.height).toBeLessThanOrEqual(bounds.viewport.height)
            expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport.height)
        }).toPass()
        await page.screenshot({ path: testInfo.outputPath(`trace-${width}-light.png`) })
        await page.getByTestId('theme-toggle').click()
        await expect(page.locator('body')).toHaveCSS('color', 'rgb(250, 250, 250)')
        await page.screenshot({ path: testInfo.outputPath(`trace-${width}-dark.png`) })

        // Switching traces must discard the old descendants and selection.
        await page.locator('[data-trace-id="trace-e2e-search-hit"]').click()
        await expect(panel.getByRole('treeitem')).toHaveCount(1)
        await expect(panel.locator('.detail-panel')).toHaveText('Select a span to see its details.')
    })
}

test('every tab keeps scrolling inside its panels', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    for (const tab of [
        'timeline',
        'traces',
        'logs',
        'metrics',
        'models',
        'analytics',
        'sessions',
    ]) {
        await page.goto(`/#${tab}`)
        await page.waitForLoadState('networkidle')
        const bounds = await page.evaluate(() => ({
            height: document.documentElement.scrollHeight,
            width: document.documentElement.scrollWidth,
        }))
        expect(bounds, tab).toEqual({ height: 720, width: 1280 })
    }
})
