import { test, expect, afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-telemetry-'))
const received: any[] = []
const collector = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(req) {
        received.push(await req.json())
        return Response.json({})
    },
})
Object.assign(process.env, {
    DATA_DIR: directory,
    DB_PATH: path.join(directory, 'test.db'),
    DASHBOARD_PORT: '0',
    PROXY_PORT: '0',
    PRICING_URL: 'https://127.0.0.1:1/no',
    OTLP_EXPORT_TRACES_ENDPOINT: collector.url.toString(),
    OTLP_EXPORT_LOGS_ENDPOINT: collector.url.toString(),
    OTLP_EXPORT_METRICS_ENDPOINT: collector.url.toString(),
    OTLP_EXPORT_BATCH_SIZE: '10000',
})
const db = await import('@llmflow/db')
const { startDashboardServer } = await import('../src/server')
const { initExportHooks, flushAll } = require('@llmflow/otlp/export')
const { messageType } = require('@llmflow/otlp/transport')
const { nanoToMs } = require('../../../packages/otlp/src/timestamps')
const server = startDashboardServer()
const stop = initExportHooks(db)
afterAll(async () => {
    await stop()
    server.stop(true)
    collector.stop(true)
    db.close()
    rmSync(directory, { recursive: true, force: true })
})
const attr = (key: string, value: string) => ({ key, value: { stringValue: value } })
function payload(signal: string, id: string) {
    const resource = { attributes: [attr('service.name', 'transport-fixture')] }
    const time = '1750000000123456789'
    if (signal === 'trace')
        return {
            resourceSpans: [
                {
                    resource,
                    scopeSpans: [
                        {
                            spans: [
                                {
                                    traceId: '11223344556677889900112233445566',
                                    spanId: id,
                                    name: id,
                                    startTimeUnixNano: time,
                                    endTimeUnixNano: '1750000000124456789',
                                },
                            ],
                        },
                    ],
                },
            ],
        }
    if (signal === 'logs')
        return {
            resourceLogs: [
                {
                    resource,
                    scopeLogs: [
                        {
                            logRecords: [
                                {
                                    timeUnixNano: '0',
                                    observedTimeUnixNano: time,
                                    body: { stringValue: id },
                                    traceId: '11223344556677889900112233445566',
                                    spanId: id,
                                },
                            ],
                        },
                    ],
                },
            ],
        }
    return {
        resourceMetrics: [
            {
                resource,
                scopeMetrics: [
                    {
                        metrics: [
                            {
                                name: id,
                                gauge: { dataPoints: [{ timeUnixNano: time, asInt: '42' }] },
                            },
                        ],
                    },
                ],
            },
        ],
    }
}
function encode(signal: string, value: any) {
    const body = structuredClone(value)
    function convert(item: any) {
        if (!item || typeof item !== 'object') return
        for (const key of Object.keys(item)) {
            if (['traceId', 'spanId'].includes(key)) item[key] = Buffer.from(item[key], 'hex')
            else convert(item[key])
        }
    }
    convert(body)
    const type = messageType(signal, 'Request')
    return type.encode(type.fromObject(body)).finish()
}
test('JSON/protobuf with identity/gzip persist all three signals and exact IDs/times', async () => {
    let index = 1
    for (const signal of ['trace', 'logs', 'metrics'])
        for (const protobuf of [false, true])
            for (const gzip of [false, true]) {
                const id = String(index++).padStart(16, '0')
                let body = protobuf
                    ? encode(signal, payload(signal, id))
                    : Buffer.from(JSON.stringify(payload(signal, id)))
                if (gzip) body = gzipSync(body)
                const response = await fetch(
                    new URL(`/v1/${signal === 'trace' ? 'traces' : signal}`, server.url),
                    {
                        method: 'POST',
                        body,
                        headers: {
                            'content-type': protobuf
                                ? 'application/x-protobuf'
                                : 'application/json',
                            'content-encoding': gzip ? 'gzip' : 'identity',
                        },
                    },
                )
                expect(response.status).toBe(200)
                if (protobuf)
                    expect(
                        messageType(signal, 'Response').decode(
                            new Uint8Array(await response.arrayBuffer()),
                        ),
                    ).toBeDefined()
                else expect(await response.json()).toEqual({})
                if (signal === 'trace') {
                    const row: any = db.getTraceById(id)
                    expect(row.trace_id).toBe('11223344556677889900112233445566')
                    expect(row.timestamp).toBe(1750000000123)
                    expect(row.duration_ms).toBe(1)
                } else if (signal === 'logs') {
                    const row: any = db.getLogs({ limit: 100 }).find((row: any) => row.body === id)
                    expect(row.timestamp).toBe(1750000000123)
                    expect(row.span_id).toBe(id)
                } else
                    expect(
                        (db.getMetrics({ limit: 100 }).find((row: any) => row.name === id) as any)
                            ?.value_int,
                    ).toBe(42)
            }
})
test('transport rejects bad media, malformed bodies and compressed bombs cleanly', async () => {
    for (const [type, encoding, body, status] of [
        ['text/plain', 'identity', '{}', 415],
        ['application/json', 'br', '{}', 415],
        ['application/json', 'identity', '{', 400],
        ['application/json', 'identity', '{"resourceSpans":[null]}', 400],
        ['application/x-protobuf', 'identity', new Uint8Array([255]), 400],
        ['application/json', 'gzip', 'bad', 400],
        ['application/json', 'gzip', gzipSync(Buffer.alloc(17 * 1024 * 1024, 32)), 413],
        ['application/json', 'identity', Buffer.alloc(4 * 1024 * 1024 + 1), 413],
    ] as const) {
        const response = await fetch(new URL('/v1/traces', server.url), {
            method: 'POST',
            body,
            headers: { 'content-type': type, 'content-encoding': encoding },
        })
        expect(response.status).toBe(status)
    }
})
test('timestamps are nullable for missing, zero, negative, malformed and unsafe values', () => {
    for (const value of [
        undefined,
        null,
        '',
        0,
        '0',
        -1,
        '-10',
        'bad',
        '1.5',
        Number.MAX_SAFE_INTEGER + 1,
    ])
        expect(nanoToMs(value)).toBeNull()
    expect(nanoToMs('1750000000123456789')).toBe(1750000000123)
})
test('multiple subscribers and exporter receive complete records while websocket gets summaries', async () => {
    await flushAll()
    received.length = 0
    expect(initExportHooks(db)).toBe(stop)
    let calls = 0
    const unsubscribe = db.subscribeTraces(() => {
        calls++
    })
    const bad = db.subscribeTraces(() => {
        throw new Error('subscriber failure')
    })
    const asyncBad = db.subscribeTraces(async () => {
        throw new Error('async subscriber failure')
    })
    const messages: any[] = []
    const socket = new WebSocket(new URL('/ws', server.url).toString().replace('http:', 'ws:'), {
        headers: { Origin: server.url.origin },
    } as any)
    await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        socket.onerror = reject
    })
    socket.onmessage = (event) => messages.push(JSON.parse(String(event.data)))
    db.insertTrace({
        id: 'abcdef1234567890',
        trace_id: 'abcdef1234567890abcdef1234567890',
        timestamp: Date.now(),
        provider: 'anthropic',
        model: 'fixture',
        prompt_tokens: 123,
        completion_tokens: 45,
        total_tokens: 168,
        request_headers: {
            Authorization: 'test-secret',
            Cookie: 'cookie-secret',
            'X-Api-Key': 'key-secret',
        },
        request_path: '/test?key=query-secret&keep=ok',
    })
    db.insertLog({
        id: 'export-log',
        timestamp: Date.now(),
        body: 'long log '.repeat(100),
        service_name: 'my-service',
        scope_name: 'my-scope',
        attributes: { nested: ['one', 'two'] },
        resource_attributes: { region: 'eu' },
    })
    db.insertMetric({
        id: 'export-metric',
        timestamp: Date.now(),
        name: 'hist',
        metric_type: 'histogram',
        histogram_data: {
            count: 3,
            sum: 6,
            min: 1,
            max: 3,
            bucketCounts: [1, 2],
            explicitBounds: [1],
        },
        attributes: { region: 'eu', success: true },
    })
    await flushAll()
    await Bun.sleep(30)
    expect(calls).toBe(1)
    unsubscribe()
    bad()
    asyncBad()
    socket.close()
    const span = received.find((x) => x.resourceSpans).resourceSpans[0].scopeSpans[0].spans[0]
    expect(
        span.attributes.find((x: any) => x.key === 'gen_ai.usage.input_tokens').value.intValue,
    ).toBe('123')
    expect(
        span.attributes.find((x: any) => x.key === 'gen_ai.provider.name').value.stringValue,
    ).toBe('anthropic')
    const logs = received.find((x) => x.resourceLogs).resourceLogs[0]
    expect(logs.scopeLogs[0].logRecords[0].body.stringValue).toHaveLength(900)
    expect(logs.scopeLogs[0].scope.name).toBe('my-scope')
    const hist = received.find((x) => x.resourceMetrics).resourceMetrics[0].scopeMetrics[0]
        .metrics[0].histogram.dataPoints[0]
    expect(hist.bucketCounts).toEqual([1, 2])
    expect(hist.explicitBounds).toEqual([1])
    expect(hist.min).toBe(1)
    expect(hist.max).toBe(3)
    expect(messages.filter((x) => x.type === 'new_trace')).toHaveLength(1)
    expect(messages.find((x) => x.type === 'new_log').payload.body.length).toBeLessThanOrEqual(200)
    expect(JSON.stringify([db.getTraceById('abcdef1234567890'), messages, received])).not.toContain(
        'test-secret',
    )
})

test.skipIf(!process.env.LLMFLOW_PYTHON)(
    'real Python HTTP exporter persists gzip protobuf with exact span ID',
    async () => {
        const child = Bun.spawn(
            [process.env.LLMFLOW_PYTHON!, path.join(import.meta.dir, 'python-otlp.py')],
            {
                env: { ...process.env, LLMFLOW_URL: server.url.origin },
                stdout: 'pipe',
                stderr: 'pipe',
            },
        )
        const [output, errors, code] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
        ])
        expect({ code, errors }).toEqual({ code: 0, errors: '' })
        expect(db.getTraceById(output.trim())).toMatchObject({
            span_name: 'python-protobuf-gzip',
            model: 'python-fixture',
        })
    },
    15000,
)

test('structured log bodies and nested attributes survive actual ingest and collector export', async () => {
    await flushAll()
    received.length = 0
    const response = await fetch(new URL('/v1/logs', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            resourceLogs: [
                {
                    scopeLogs: [
                        {
                            logRecords: [
                                {
                                    body: {
                                        kvlistValue: {
                                            values: [
                                                {
                                                    key: 'answer',
                                                    value: {
                                                        arrayValue: {
                                                            values: [
                                                                { stringValue: 'text' },
                                                                { boolValue: true },
                                                            ],
                                                        },
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                    attributes: [
                                        {
                                            key: 'labels',
                                            value: {
                                                arrayValue: {
                                                    values: [
                                                        { stringValue: 'one' },
                                                        { stringValue: 'two' },
                                                    ],
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        }),
    })
    expect(response.status).toBe(200)
    await flushAll()
    const row = received[0].resourceLogs[0].scopeLogs[0].logRecords[0]
    expect(row.body).toEqual({
        kvlistValue: {
            values: [
                {
                    key: 'answer',
                    value: {
                        arrayValue: { values: [{ stringValue: 'text' }, { boolValue: true }] },
                    },
                },
            ],
        },
    })
    expect(row.attributes.find((attribute: any) => attribute.key === 'labels').value).toEqual({
        arrayValue: { values: [{ stringValue: 'one' }, { stringValue: 'two' }] },
    })
})
