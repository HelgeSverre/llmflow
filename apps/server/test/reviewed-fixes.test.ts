import { afterAll, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-reviewed-'))
process.env.DATA_DIR = directory
process.env.DB_PATH = path.join(directory, 'test.db')
process.env.DASHBOARD_PORT = '0'
process.env.PROXY_PORT = '0'
delete process.env.DASHBOARD_HOST
delete process.env.PROXY_HOST
process.env.OTLP_EXPORT_ENABLED = 'false'
delete process.env.OTLP_EXPORT_ENDPOINT
delete process.env.OTLP_EXPORT_TRACES_ENDPOINT
delete process.env.OTLP_EXPORT_LOGS_ENDPOINT
delete process.env.OTLP_EXPORT_METRICS_ENDPOINT

mock.module('@llmflow/pricing', () => ({
    calculateCost: (_model: string, input: number, output: number) =>
        input * 0.001 + output * 0.002,
    getPricingStatus: () => ({ source: 'fixture' }),
}))

const { startDashboardServer, startProxyServer } = await import('../src/server')
const db = await import('@llmflow/db')
const dashboard = startDashboardServer()
const proxy = startProxyServer()

afterAll(() => {
    dashboard.stop(true)
    proxy.stop(true)
    db.close()
    rmSync(directory, { recursive: true, force: true })
})

test('both listeners bind to loopback by default and answer requests', async () => {
    expect(dashboard.hostname).toBe('127.0.0.1')
    expect(proxy.hostname).toBe('127.0.0.1')
    expect((await fetch(new URL('/api/health', dashboard.url))).status).toBe(200)
    expect((await fetch(new URL('/health', proxy.url))).status).toBe(200)
})

test('existing OTLP integration suite passes against the isolated listener', async () => {
    const child = Bun.spawn([process.execPath, path.join(import.meta.dir, 'otlp-e2e.js')], {
        env: { ...process.env, LLMFLOW_URL: dashboard.url.toString().replace(/\/$/, '') },
        stdout: 'pipe',
        stderr: 'pipe',
    })
    const [output, errors, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ])
    expect({ code, errors, failed: output.includes('✗') }).toEqual({
        code: 0,
        errors: '',
        failed: false,
    })
}, 15000)

test('explicit host overrides change the actual listener addresses', async () => {
    const child = Bun.spawn(
        [
            process.execPath,
            '-e',
            `
        const { startDashboardServer, startProxyServer } = await import('./apps/server/src/server.ts')
        const a = startDashboardServer(), b = startProxyServer()
        console.log(JSON.stringify([a.hostname, b.hostname]))
        a.stop(true); b.stop(true)
        process.exit(0)
    `,
        ],
        {
            cwd: path.resolve(import.meta.dir, '../../..'),
            env: {
                ...process.env,
                DB_PATH: path.join(directory, 'override.db'),
                DASHBOARD_HOST: '0.0.0.0',
                PROXY_HOST: '0.0.0.0',
                PRICING_URL: 'https://127.0.0.1:1/pricing.json',
            },
            stdout: 'pipe',
            stderr: 'pipe',
        },
    )
    const output = await new Response(child.stdout).text()
    expect(await child.exited).toBe(0)
    expect(JSON.parse(output.trim())).toEqual(['0.0.0.0', '0.0.0.0'])
})

function attributes(values: Record<string, unknown>) {
    return Object.entries(values).map(([key, value]) => ({
        key,
        value:
            typeof value === 'number'
                ? { intValue: String(value) }
                : {
                      stringValue: typeof value === 'string' ? value : JSON.stringify(value),
                  },
    }))
}

async function ingest(values: Record<string, unknown>, events: unknown[] = []) {
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 16)
    const response = await fetch(new URL('/v1/traces', dashboard.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resourceSpans: [
                {
                    scopeSpans: [
                        {
                            spans: [
                                {
                                    traceId: crypto.randomUUID().replaceAll('-', ''),
                                    spanId: id,
                                    name: 'chat fixture',
                                    startTimeUnixNano: '1000000000',
                                    endTimeUnixNano: '1100000000',
                                    attributes: attributes({
                                        'gen_ai.request.model': 'fixture',
                                        ...values,
                                    }),
                                    events,
                                },
                            ],
                        },
                    ],
                },
            ],
        }),
    })
    expect(response.status).toBe(200)
    const tree = await (await fetch(new URL(`/api/traces/${id}/tree`, dashboard.url))).json()
    expect(tree.spans).toHaveLength(1)
    return tree.spans[0]
}

test('current and legacy OTLP token attributes persist usage and deterministic cost', async () => {
    for (const [input, output] of [
        ['input_tokens', 'output_tokens'],
        ['prompt_tokens', 'completion_tokens'],
    ]) {
        const row = await ingest({
            [`gen_ai.usage.${input}`]: 1000,
            [`gen_ai.usage.${output}`]: 25,
        })
        expect(row.prompt_tokens).toBe(1000)
        expect(row.completion_tokens).toBe(25)
        expect(row.total_tokens).toBe(1025)
        expect(row.estimated_cost).toBeCloseTo(1.05)
    }
    const row = await ingest({
        'gen_ai.usage.input_tokens': 0,
        'gen_ai.usage.prompt_tokens': 1000,
        'gen_ai.usage.output_tokens': 25,
        'gen_ai.usage.completion_tokens': 99,
    })
    expect(row.prompt_tokens).toBe(0)
    expect(row.completion_tokens).toBe(25)
    expect(row.total_tokens).toBe(25)
    expect(row.estimated_cost).toBeCloseTo(0.05)
})

test('system instructions supplement legacy and event messages without suppressing them', async () => {
    const instructions = [{ type: 'text', content: 'Be helpful' }]
    const messages = [{ role: 'user', parts: [{ type: 'text', content: 'hello' }] }]
    for (const prompt of ['hello', messages]) {
        const row = await ingest({
            'gen_ai.system_instructions': instructions,
            'gen_ai.prompt': prompt,
        })
        expect(row.input.system_instructions).toEqual(instructions)
        if (typeof prompt === 'string') expect(row.input.prompt).toBe(prompt)
        else expect(row.input.messages).toEqual(messages)
    }
    const row = await ingest({ 'gen_ai.system_instructions': instructions }, [
        {
            name: 'gen_ai.client.inference.operation.details',
            attributes: attributes({ 'gen_ai.input.messages': messages }),
        },
    ])
    expect(row.input).toEqual({ messages, system_instructions: instructions })
    const current = await ingest({
        'gen_ai.input.messages': messages,
        'gen_ai.prompt': 'legacy',
        'gen_ai.system_instructions': instructions,
    })
    expect(current.input).toEqual({ messages, system_instructions: instructions })
})

test('model API reports measured token splits and mean LLM latency', async () => {
    for (const [input, output, duration] of [
        [900, 100, 200],
        [10, 90, 600],
    ])
        db.insertTrace({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            model: 'measured-fixture',
            prompt_tokens: input,
            completion_tokens: output,
            total_tokens: input + output,
            duration_ms: duration,
            span_type: 'llm',
        })
    db.insertTrace({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        model: 'unknown-latency',
        span_type: 'agent',
    })
    const models = await (await fetch(new URL('/api/models', dashboard.url))).json()
    expect(models.find((model: any) => model.model === 'measured-fixture')).toMatchObject({
        prompt_tokens: 910,
        completion_tokens: 190,
        total_tokens: 1100,
        avg_latency: 400,
    })
    expect(models.find((model: any) => model.model === 'unknown-latency').avg_latency).toBeNull()
    await fetch(new URL('/api/spans', dashboard.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ span_type: 'llm', model: 'zero-latency', duration_ms: 0 }),
    })
    const updated = await (await fetch(new URL('/api/models', dashboard.url))).json()
    expect(updated.find((model: any) => model.model === 'zero-latency').avg_latency).toBe(0)
})
test('hostile or missing WebSocket origins are rejected before upgrade', async () => {
    for (const origin of [undefined, 'null', 'https://hostile.example', 'bad origin']) {
        const response = await fetch(new URL('/ws', dashboard.url), {
            headers: {
                Upgrade: 'websocket',
                Connection: 'Upgrade',
                'Sec-WebSocket-Version': '13',
                'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
                ...(origin ? { Origin: origin } : {}),
            },
        })
        expect(response.status).toBe(403)
    }
})
