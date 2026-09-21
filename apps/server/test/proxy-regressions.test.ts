import { test, expect, afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AnthropicProvider, CohereProvider, BaseProvider, registry } from '@llmflow/providers'
import { AnthropicPassthrough, GeminiPassthrough } from '@llmflow/providers/passthrough'
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-proxy-'))
Object.assign(process.env, {
    DATA_DIR: directory,
    DB_PATH: path.join(directory, 'test.db'),
    PRICING_URL: 'https://127.0.0.1:1/no',
    PROXY_TIMEOUT_MS: '30000',
})
const db = await import('@llmflow/db')
const { forwardProxyRequest } = await import('../src/proxy')
let mode = 'anthropic',
    upstreamUrl = '',
    upstreamAuth = '',
    disconnected = false
const anthropic = [
    {
        type: 'message_start',
        message: {
            model: 'claude-fixture',
            usage: { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 20 },
        },
    },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'héllo 🌍' } },
    {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'call_1', name: 'weather', input: {} },
    },
    {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"city":' },
    },
    {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '"Oslo"}' },
    },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 12 } },
    { type: 'message_stop' },
]
    .map((x) => `event: ${x.type}\r\ndata: ${JSON.stringify(x)}\r\n\r\n`)
    .join('')
const upstream = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    idleTimeout: 0,
    async fetch(req) {
        upstreamUrl = req.url
        upstreamAuth = req.headers.get('x-api-key') || req.headers.get('authorization') || ''
        req.signal.addEventListener('abort', () => {
            disconnected = true
        })
        if (mode === 'text') return new Response('not JSON: upstream unavailable', { status: 503 })
        if (mode === 'cohere-error')
            return Response.json(
                { id: 'cohere-error', message: 'Model not found' },
                { status: 404 },
            )
        if (mode === 'responses-tool')
            return new Response(
                'event: response.completed\ndata: ' +
                    JSON.stringify({
                        type: 'response.completed',
                        response: {
                            model: 'fixture',
                            output: [
                                {
                                    type: 'function_call',
                                    id: 'fc_1',
                                    call_id: 'call_1',
                                    name: 'read',
                                    arguments: '{"path":"fixture.txt"}',
                                },
                            ],
                            usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12 },
                        },
                    }) +
                    '\n\n',
                { headers: { 'content-type': 'text/event-stream' } },
            )
        if (mode === 'slow') {
            await Bun.sleep(11000)
            return Response.json({
                model: 'fixture',
                usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
            })
        }
        if (mode === 'stall') {
            await Bun.sleep(1000)
            return new Response('late')
        }
        if (mode === 'json')
            return Response.json({
                model: 'fixture',
                usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
            })
        const wire =
            mode === 'gemini'
                ? `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini text' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6, totalTokenCount: 10 } })}\n\n`
                : anthropic
        let offset = 0
        const bytes = new TextEncoder().encode(wire)
        return new Response(
            new ReadableStream({
                async pull(output) {
                    if (mode === 'quiet' && offset === 200) await Bun.sleep(11000)
                    if (offset >= bytes.length) {
                        output.close()
                        return
                    }
                    const end = Math.min(offset + (mode === 'quiet' ? 200 : 3), bytes.length)
                    output.enqueue(bytes.slice(offset, end))
                    offset = end
                },
                cancel() {
                    disconnected = true
                },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
        )
    },
})
class MockAnthropic extends AnthropicProvider {
    override getTarget(req: any) {
        return { hostname: '127.0.0.1', port: upstream.port!, protocol: 'http', path: req.path }
    }
}
class MockOpenAI extends BaseProvider {
    override getTarget(req: any) {
        return { hostname: '127.0.0.1', port: upstream.port!, protocol: 'http', path: req.path }
    }
}
registry.register('fixture', new MockAnthropic())
registry.register('plain', new MockOpenAI())
class MockCohere extends CohereProvider {
    override getTarget(req: any) {
        return { hostname: '127.0.0.1', port: upstream.port!, protocol: 'http', path: req.path }
    }
}
registry.register('cohere-fixture', new MockCohere())
const native = new AnthropicPassthrough()
native.targetHost = '127.0.0.1'
native.targetPort = upstream.port!
native.protocol = 'http'
const gemini = new GeminiPassthrough()
gemini.targetHost = '127.0.0.1'
gemini.targetPort = upstream.port!
gemini.protocol = 'http'
const proxy = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    idleTimeout: 0,
    fetch(req) {
        const url = new URL(req.url)
        return forwardProxyRequest(
            req,
            url,
            url.pathname.startsWith('/native')
                ? { handler: native, prefix: '/native' }
                : url.pathname.startsWith('/google')
                  ? { handler: gemini, prefix: '/google' }
                  : undefined,
        )
    },
})
afterAll(() => {
    proxy.stop(true)
    upstream.stop(true)
    db.close()
    rmSync(directory, { recursive: true, force: true })
})
async function send(route: string, stream = true, extraHeaders = {}) {
    return fetch(new URL(route, proxy.url), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: 'Bearer fixture-secret',
            'x-trace-id': 'shared-trace',
            'x-parent-id': 'root',
            'x-llmflow-tags': 'one,two',
            ...extraHeaders,
        },
        body: JSON.stringify({
            model: 'fixture',
            stream,
            messages: [{ role: 'user', content: 'hi' }],
        }),
    })
}
test('normalized Anthropic stream translates incremental text/tools/usage; native bytes stay native', async () => {
    mode = 'anthropic'
    const normalized = await (
        await send('/fixture/v1/chat/completions?keep=a&keep=b&key=query-secret')
    ).text()
    expect(normalized).toContain('chat.completion.chunk')
    expect(normalized).not.toContain('content_block_delta')
    const frames = normalized
        .split('\n\n')
        .filter((x) => x.startsWith('data: {'))
        .map((x) => JSON.parse(x.slice(6)))
    expect(frames.map((x) => x.choices[0].delta.content || '').join('')).toBe('héllo 🌍')
    expect(frames.find((x) => x.usage).usage).toMatchObject({
        prompt_tokens: 100,
        completion_tokens: 12,
        total_tokens: 112,
        cache_read_input_tokens: 20,
    })
    expect(normalized).toContain('tool_calls')
    expect(normalized.endsWith('data: [DONE]\n\n')).toBe(true)
    expect(new URL(upstreamUrl).searchParams.getAll('keep')).toEqual(['a', 'b'])
    expect(upstreamAuth).toBe('fixture-secret')
    expect(await (await send('/native/v1/messages')).text()).toBe(anthropic)
    const rows: any[] = db.getSpansByTraceId('shared-trace') as any[]
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((x) => x.id)).size).toBe(2)
    for (const row of rows) {
        expect(row.parent_id).toBe('root')
        expect(JSON.parse(row.tags)).toEqual(['one', 'two'])
        expect(row.prompt_tokens).toBe(100)
        expect(row.completion_tokens).toBe(12)
        expect(JSON.stringify(row)).not.toContain('fixture-secret')
    }
    expect(JSON.stringify(rows)).not.toContain('query-secret')
})
test('native Gemini recognizes URL streaming and logs model and final usage', async () => {
    mode = 'gemini'
    const response = await send(
        '/google/v1beta/models/gemini-fixture:streamGenerateContent?alt=sse&key=query-secret',
        false,
    )
    expect(await response.text()).toContain('Gemini text')
    const rows: any[] = db.getSpansByTraceId('shared-trace') as any[]
    expect(rows.find((x) => x.model === 'gemini-fixture')).toMatchObject({
        prompt_tokens: 4,
        completion_tokens: 6,
        total_tokens: 10,
    })
})
test('non-JSON upstream errors keep status and body without rereading consumed streams', async () => {
    mode = 'text'
    for (const route of ['/native/v1/messages', '/plain/v1/chat/completions']) {
        const response = await send(route, false)
        expect(response.status).toBe(503)
        expect(await response.text()).toContain('upstream unavailable')
    }
})
test('Cohere HTTP errors preserve actionable payloads for clients and stored traces', async () => {
    mode = 'cohere-error'
    const response = await send('/cohere-fixture/v1/chat/completions', false, {
        'x-trace-id': 'cohere-error-trace',
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ id: 'cohere-error', message: 'Model not found' })
    const row: any = db.getSpansByTraceId('cohere-error-trace')[0]
    expect(row.status).toBe(404)
    expect(JSON.parse(row.response_body)).toEqual({
        id: 'cohere-error',
        message: 'Model not found',
    })
})
test('Responses stream is forwarded intact while tool calls and usage are persisted', async () => {
    mode = 'responses-tool'
    const response = await send('/plain/v1/responses', true, {
        'x-trace-id': 'responses-tool-trace',
    })
    expect(await response.text()).toContain('response.completed')
    const row: any = db.getSpansByTraceId('responses-tool-trace')[0]
    expect(row.total_tokens).toBe(12)
    expect(JSON.parse(row.response_body).choices[0]).toMatchObject({
        finish_reason: 'tool_calls',
        message: {
            tool_calls: [
                { id: 'call_1', function: { name: 'read', arguments: '{"path":"fixture.txt"}' } },
            ],
        },
    })
})
test('configured deadline terminates stalled upstream and persists one failure', async () => {
    mode = 'stall'
    process.env.PROXY_TIMEOUT_MS = '30'
    const before = db.getTraceCount()
    const response = await send('/plain/v1/chat/completions', false)
    expect(response.status).toBe(504)
    expect(db.getTraceCount()).toBe(before + 1)
    process.env.PROXY_TIMEOUT_MS = '30000'
})
test('an initial response longer than Bun default idle timeout remains usable', async () => {
    mode = 'slow'
    const response = await send('/plain/v1/chat/completions', false)
    expect(response.status).toBe(200)
    expect((await response.json()).usage.total_tokens).toBe(5)
}, 15000)

test('a quiet streaming gap stays open; cancelling downstream stops upstream work', async () => {
    mode = 'quiet'
    const response = await send('/native/v1/messages')
    expect(await response.text()).toBe(anthropic)
    mode = 'quiet'
    disconnected = false
    const cancellation = await send('/native/v1/messages')
    const reader = cancellation.body!.getReader()
    await reader.read()
    await reader.cancel()
    for (let i = 0; i < 50 && !disconnected; i++) await Bun.sleep(10)
    expect(disconnected).toBe(true)
}, 15000)
