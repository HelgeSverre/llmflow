import { afterAll, beforeAll, expect, test } from 'bun:test'
import { startTestServer } from './helpers/test-server'

const server = await startTestServer({ prefix: 'llmflow-otlp-metrics-' })
afterAll(() => server.stop())

async function api(path: string, body?: unknown) {
    const response = await fetch(server.url + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, data: (await response.json().catch(() => null)) as any }
}

// Simulates what Claude Code or Gemini CLI send.
function metricsPayload(serviceName: string, metrics: unknown[]) {
    return {
        resourceMetrics: [
            {
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: serviceName } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } },
                    ],
                },
                scopeMetrics: [
                    { scope: { name: `${serviceName}.metrics`, version: '1.0.0' }, metrics },
                ],
            },
        ],
    }
}

const string = (key: string, value: string) => ({ key, value: { stringValue: value } })
const nowNano = () => String(Date.now() * 1000000)

beforeAll(async () => {
    const batches = [
        metricsPayload('claude-code', [
            {
                name: 'claude_code.token.usage',
                description: 'Test metric',
                unit: 'tokens',
                sum: {
                    dataPoints: [
                        {
                            timeUnixNano: nowNano(),
                            asInt: '1500',
                            attributes: [
                                string('type', 'input'),
                                string('model', 'claude-sonnet-4-20250514'),
                            ],
                        },
                    ],
                    aggregationTemporality: 2,
                    isMonotonic: true,
                },
            },
        ]),
        metricsPayload('gemini-cli', [
            {
                name: 'gemini_cli.session.active',
                description: 'Test gauge',
                unit: 'count',
                gauge: {
                    dataPoints: [
                        {
                            timeUnixNano: nowNano(),
                            asDouble: 3.5,
                            attributes: [string('instance', 'main')],
                        },
                    ],
                },
            },
        ]),
        metricsPayload('claude-code', [
            {
                name: 'claude_code.api.latency',
                description: 'Test histogram',
                unit: 'ms',
                histogram: {
                    dataPoints: [
                        {
                            timeUnixNano: nowNano(),
                            count: '45',
                            sum: 2250.5,
                            bucketCounts: ['5', '10', '15', '10', '5'],
                            explicitBounds: [10, 50, 100, 500],
                            min: 5,
                            max: 800,
                            attributes: [string('endpoint', '/v1/messages')],
                        },
                    ],
                    aggregationTemporality: 2,
                },
            },
        ]),
    ]
    for (const payload of batches) {
        const result = await api('/v1/metrics', payload)
        expect(result.status).toBe(200)
        expect(result.data.partialSuccess).toBeFalsy()
    }
})

async function metric(name: string) {
    const result = await api(`/api/metrics?name=${encodeURIComponent(name)}`)
    expect(result.status).toBe(200)
    return result.data.metrics.find((row: any) => row.name === name)
}

test('a sum metric stores its integer value and service', async () => {
    expect(await metric('claude_code.token.usage')).toMatchObject({
        metric_type: 'sum',
        value_int: 1500,
        service_name: 'claude-code',
    })
})

test('a gauge metric stores its double value', async () => {
    expect(await metric('gemini_cli.session.active')).toMatchObject({
        metric_type: 'gauge',
        value_double: 3.5,
    })
})

test('a histogram metric stores its count as value_int', async () => {
    expect(await metric('claude_code.api.latency')).toMatchObject({
        metric_type: 'histogram',
        value_int: 45,
    })
})

test('a metric is retrievable by id with parsed attributes', async () => {
    const [first] = (await api('/api/metrics?limit=1')).data.metrics
    expect(first).toBeDefined()
    const single = await api(`/api/metrics/${first.id}`)
    expect(single.status).toBe(200)
    expect(single.data.id).toBe(first.id)
    expect(typeof single.data.attributes).toBe('object')
})

test('the summary aggregation includes the token usage metric', async () => {
    const summary = await api('/api/metrics?aggregation=summary')
    expect(summary.status).toBe(200)
    expect(Array.isArray(summary.data.summary)).toBe(true)
    const tokens = summary.data.summary.find((row: any) => row.name === 'claude_code.token.usage')
    expect(tokens?.data_points).toBeGreaterThanOrEqual(1)
})

test('service and type filters return only matching metrics', async () => {
    const byService = await api('/api/metrics?service_name=claude-code')
    expect(byService.status).toBe(200)
    expect(byService.data.metrics).toHaveLength(2)
    for (const row of byService.data.metrics) expect(row.service_name).toBe('claude-code')

    const byType = await api('/api/metrics?metric_type=sum')
    expect(byType.status).toBe(200)
    expect(byType.data.metrics).toHaveLength(1)
    for (const row of byType.data.metrics) expect(row.metric_type).toBe('sum')
})

test('filter options and the token usage endpoint respond', async () => {
    const filters = await api('/api/metrics/filters')
    expect(filters.status).toBe(200)
    expect(Array.isArray(filters.data.names)).toBe(true)
    expect(filters.data.services).toEqual(expect.arrayContaining(['claude-code', 'gemini-cli']))

    const tokens = await api('/api/metrics/tokens')
    expect(tokens.status).toBe(200)
    expect(Array.isArray(tokens.data.usage)).toBe(true)
})

test('an empty payload is accepted and an unknown id is a 404', async () => {
    expect((await api('/v1/metrics', {})).status).toBe(200)
    expect((await api('/api/metrics/nonexistent-id')).status).toBe(404)
})
