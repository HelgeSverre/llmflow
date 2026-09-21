import { test, expect, afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-contracts-'))
Object.assign(process.env, {
    DATA_DIR: directory,
    DB_PATH: path.join(directory, 'test.db'),
    DASHBOARD_HOST: '127.0.0.1',
    DASHBOARD_PORT: '0',
    OTLP_EXPORT_ENABLED: 'false',
    PRICING_URL: 'http://127.0.0.1:1/no',
})
const db = await import('@llmflow/db')
const { startDashboardServer } = await import('../src/server')
const server = startDashboardServer()
afterAll(() => {
    server.stop(true)
    db.close()
    rmSync(directory, { recursive: true, force: true })
})
const get = async (route: string) =>
    (await fetch(new URL(route, server.url))).json() as Promise<any>
async function post(route: string, body: unknown) {
    const response = await fetch(new URL(route, server.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    expect(response.ok).toBe(true)
    return response.json() as Promise<any>
}

test('direct span correlation survives persistence and session/filter APIs', async () => {
    await post('/api/spans', {
        id: 'row',
        trace_id: 'trace',
        session_id: 'session',
        conversation_id: 'conversation',
        agent_name: 'agent',
        span_name: 'direct',
        duration_ms: 0,
    })
    const sessions = await get('/api/sessions')
    expect(sessions.sessions[0]).toMatchObject({
        session_id: 'session',
        agent_name: 'agent',
        trace_count: 1,
    })
    const rows = await get('/api/traces?session_id=session&conversation_id=conversation')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
        id: 'row',
        trace_id: 'trace',
        session_id: 'session',
        conversation_id: 'conversation',
        agent_name: 'agent',
    })
})

test('OTLP timing distinguishes unknown, reversed, equal and measured intervals', async () => {
    const start = BigInt(Date.now()) * 1000000n
    const cases = [
        undefined,
        'broken',
        String(start - 1000000n),
        String(start),
        String(start + 15000000n),
    ]
    for (const [index, end] of cases.entries()) {
        const id = (index + 1).toString(16).padStart(16, '0')
        await post('/v1/traces', {
            resourceSpans: [
                {
                    scopeSpans: [
                        {
                            spans: [
                                {
                                    traceId: id.padStart(32, '0'),
                                    spanId: id,
                                    name: `timing-${index}`,
                                    startTimeUnixNano: String(start),
                                    ...(end === undefined ? {} : { endTimeUnixNano: end }),
                                },
                            ],
                        },
                    ],
                },
            ],
        })
        const tree = await get(`/api/traces/${id}/tree`)
        const expected = index < 3 ? null : index === 3 ? 0 : 15
        expect(tree.spans[0].duration_ms).toBe(expected)
        expect(tree.trace.duration_ms).toBe(expected)
        expect(tree.trace.end_time).toBe(
            expected == null ? null : Number(start / 1000000n) + expected,
        )
    }
})

test('metric summaries filter consistently and average all numeric gauge encodings', async () => {
    const timeUnixNano = String(BigInt(Date.now()) * 1000000n)
    const attrs = (name: string) => [{ key: 'service.name', value: { stringValue: name } }]
    const metrics = [
        {
            name: 'integer',
            gauge: {
                dataPoints: [
                    { asInt: '10', timeUnixNano },
                    { asInt: '20', timeUnixNano },
                ],
            },
        },
        {
            name: 'double',
            gauge: {
                dataPoints: [
                    { asDouble: 10, timeUnixNano },
                    { asDouble: 20, timeUnixNano },
                ],
            },
        },
        {
            name: 'mixed',
            gauge: {
                dataPoints: [
                    { asInt: '10', timeUnixNano },
                    { asDouble: 20, timeUnixNano },
                ],
            },
        },
        { name: 'zero', gauge: { dataPoints: [{ asInt: '0', timeUnixNano }] } },
        { name: 'missing', gauge: { dataPoints: [{ timeUnixNano }] } },
        {
            name: 'hist',
            histogram: { dataPoints: [{ count: '3', sum: 6, bucketCounts: ['3'], timeUnixNano }] },
        },
    ]
    await post('/v1/metrics', {
        resourceMetrics: [
            { resource: { attributes: attrs('chosen') }, scopeMetrics: [{ metrics }] },
            {
                resource: { attributes: attrs('other') },
                scopeMetrics: [
                    {
                        metrics: [
                            {
                                name: 'integer',
                                sum: { dataPoints: [{ asInt: '99', timeUnixNano }] },
                            },
                        ],
                    },
                ],
            },
        ],
    })
    const result = await get(
        '/api/metrics?aggregation=summary&service_name=chosen&metric_type=gauge',
    )
    expect(result.summary).toHaveLength(5)
    for (const name of ['integer', 'double', 'mixed'])
        expect(result.summary.find((m: any) => m.name === name).avg_value).toBe(15)
    expect(result.summary.find((m: any) => m.name === 'zero').avg_value).toBe(0)
    expect(result.summary.find((m: any) => m.name === 'missing').avg_value).toBeNull()
    const list = await get('/api/metrics?service_name=chosen&metric_type=gauge')
    expect(list.total).toBe(8)
    expect(list.metrics).toHaveLength(8)
    expect(
        (await get('/api/metrics?aggregation=summary&service_name=chosen&name=hist')).summary[0]
            .sum_int,
    ).toBe(3)
    expect(
        (await get('/api/metrics?aggregation=summary&service_name=other&metric_type=gauge'))
            .summary,
    ).toEqual([])
})

test('replay uses fresh configured credentials and stores a separate streaming result', async () => {
    const { registry } = await import('@llmflow/providers')
    const originalTarget = registry.defaultProvider.getTarget
    const oldKey = process.env.OPENAI_API_KEY
    let authorization = '',
        received: unknown,
        heavy = false
    const upstream = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        async fetch(request) {
            authorization = request.headers.get('authorization') || ''
            received = await request.json()
            if (heavy) {
                const events = Array.from(
                    { length: 1100 },
                    (_, index) =>
                        `data: ${JSON.stringify({ model: 'gpt-4o-mini', choices: [{ delta: { tool_calls: [{ index, id: `call-${index}`, function: { name: 'fixture', arguments: '{}' } }] } }] })}\n\n`,
                ).join('')
                return new Response(
                    events +
                        'data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\ndata: [DONE]\n\n',
                    { headers: { 'content-type': 'text/event-stream' } },
                )
            }
            return new Response(
                'data: {"model":"gpt-4o-mini","choices":[{"delta":{"content":"replayed"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\ndata: [DONE]\n\n',
                { headers: { 'content-type': 'text/event-stream' } },
            )
        },
    })
    registry.defaultProvider.getTarget = (request) => ({
        hostname: '127.0.0.1',
        port: upstream.port!,
        protocol: 'http',
        path: request.path,
    })
    const original = {
        id: 'replay-original',
        timestamp: Date.now(),
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: { authorization: 'Bearer obsolete-secret' },
        request_body: {
            model: 'gpt-4o-mini',
            stream: true,
            messages: [{ role: 'user', content: 'hello' }],
        },
    }
    db.insertTrace(original)
    const before = db.getTraceById(original.id)
    try {
        delete process.env.OPENAI_API_KEY
        const missing = await fetch(new URL('/api/traces/replay-original/replay', server.url), {
            method: 'POST',
        })
        expect(missing.status).toBe(400)
        expect(await missing.text()).toContain('OPENAI_API_KEY')
        process.env.OPENAI_API_KEY = 'fresh-fixture-key'
        const replay = await post('/api/traces/replay-original/replay', {})
        expect(replay.id).not.toBe(original.id)
        expect(authorization).toBe('Bearer fresh-fixture-key')
        expect(received).toEqual(original.request_body)
        const stored = db.getTraceById(replay.id) as any
        expect(stored.total_tokens).toBe(5)
        expect(stored.estimated_cost).toBeGreaterThan(0)
        expect(JSON.parse(stored.response_body).choices[0].message.content).toBe('replayed')
        expect(db.getTraceById(original.id)).toEqual(before)
        heavy = true
        const toolReplay = await post('/api/traces/replay-original/replay', {})
        const toolTrace = db.getTraceById(toolReplay.id) as any
        const capture = JSON.parse(toolTrace.response_body)
        expect(capture._truncated).toBe(true)
        expect(capture.choices[0].message.tool_calls.length).toBe(1024)
        expect(toolTrace.total_tokens).toBe(5)
        expect(toolTrace.estimated_cost).toBeGreaterThan(0)
        db.insertTrace({
            ...original,
            id: 'incomplete-request',
            request_body: { _truncated: true },
        })
        const incomplete = await fetch(
            new URL('/api/traces/incomplete-request/replay', server.url),
            { method: 'POST' },
        )
        expect(incomplete.status).toBe(400)
        expect(await incomplete.text()).toContain('incomplete')
    } finally {
        registry.defaultProvider.getTarget = originalTarget
        if (oldKey === undefined) delete process.env.OPENAI_API_KEY
        else process.env.OPENAI_API_KEY = oldKey
        upstream.stop(true)
    }
})

test('tool-heavy streams have bounded capture while forwarding every event and final usage', async () => {
    const { StreamSession } = await import('../../../packages/providers/src/stream')
    const session = new StreamSession('openai', 'gpt-4o-mini', 'budget')
    const encoder = new TextEncoder()
    let count = 0
    for (let i = 0; i < 3000; i++) {
        const event = `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: i, id: `tool-${i}`, function: { name: 'test', arguments: 'x'.repeat(3000) } }] } }] })}\n\n`
        expect(session.push(encoder.encode(event)).join('')).toBe(event)
        count++
    }
    session.push(
        encoder.encode(
            'data: {"usage":{"prompt_tokens":11,"completion_tokens":22,"total_tokens":33},"choices":[]}\n\ndata: [DONE]\n\n',
        ),
        true,
    )
    expect(count).toBe(3000)
    expect(session.tools.size).toBeLessThanOrEqual(1024)
    expect(JSON.stringify(session.response()).length).toBeLessThan(2.2 * 1024 * 1024)
    expect(session.response()._truncated).toBe(true)
    expect(session.usage.total_tokens).toBe(33)
    const anthropic = new StreamSession('anthropic', 'claude', 'bounded-indices')
    for (let i = 0; i < 1500; i++) {
        const start = {
            type: 'content_block_start',
            index: i,
            content_block: { type: 'tool_use', id: `call-${i}`, name: 'test', input: {} },
        }
        const output = anthropic.push(encoder.encode(`data: ${JSON.stringify(start)}\n\n`)).join('')
        expect(output).toContain(`"index":${i}`)
        anthropic.push(encoder.encode(`data: {"type":"content_block_stop","index":${i}}\n\n`))
    }
    expect(anthropic.tools.size).toBe(1024)
    expect(anthropic.response()._truncated).toBe(true)
})
