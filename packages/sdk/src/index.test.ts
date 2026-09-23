import { afterAll, beforeEach, expect, test } from 'bun:test'

const received: Record<string, any>[] = []
const collector = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
        if (request.method === 'POST' && new URL(request.url).pathname === '/api/spans')
            received.push(await request.json())
        return Response.json({})
    },
})
afterAll(() => collector.stop(true))

// The SDK reads LLMFLOW_URL on import.
process.env.LLMFLOW_URL = collector.url.origin
const sdk = await import('./index')

// Spans are sent without awaiting; wait until the expected number arrived.
async function spans(count: number) {
    for (let attempt = 0; attempt < 100 && received.length < count; attempt++) await Bun.sleep(10)
    return received
}

beforeEach(() => {
    received.length = 0
})

test('trace and nested spans share a trace and link parents', async () => {
    const result = await sdk.trace('workflow', async () => {
        const outer = sdk.getCurrentSpan()!
        const headers = sdk.currentTraceHeaders()
        expect(headers['x-trace-id']).toBe(outer.traceId)
        expect(headers['x-parent-id']).toBe(outer.spanId)
        return sdk.span('retrieval', 'search', async () => {
            const inner = sdk.getCurrentSpan()!
            expect(inner.traceId).toBe(outer.traceId)
            expect(inner.parentId).toBe(outer.spanId)
            return ['doc']
        })
    })
    expect(result).toEqual(['doc'])
    const [child, root] = await spans(2)
    expect(root!.span_type).toBe('trace')
    expect(root!.parent_id).toBeNull()
    expect(child!.span_type).toBe('retrieval')
    expect(child!.span_name).toBe('search')
    expect(child!.trace_id).toBe(root!.trace_id)
    expect(child!.parent_id).toBe(root!.id)
    expect(child!.output).toEqual(['doc'])
    expect(sdk.getCurrentSpan()).toBeNull()
    expect(sdk.currentTraceHeaders()).toEqual({})
})

test('span options are sent and primitive outputs are wrapped', async () => {
    await sdk.span(
        {
            type: 'tool',
            name: 'lookup',
            input: { q: 1 },
            attributes: { db: 'x' },
            tags: ['t'],
            serviceName: 'svc',
        },
        () => 42,
    )
    const [sent] = await spans(1)
    expect(sent).toMatchObject({
        span_type: 'tool',
        span_name: 'lookup',
        input: { q: 1 },
        attributes: { db: 'x' },
        tags: ['t'],
        service_name: 'svc',
        output: { result: 42 },
        status: 200,
        error: null,
    })
})

test('a failing span is recorded with status 500 and rethrows', async () => {
    await expect(
        sdk.span('tool', 'broken', async () => {
            throw new Error('nope')
        }),
    ).rejects.toThrow('nope')
    const [sent] = await spans(1)
    expect(sent).toMatchObject({ status: 500, error: 'nope' })
})

test('traced works as a standard and as a legacy decorator', async () => {
    const standard = sdk.traced('agent')(
        async function plan(this: { goal: string }, step: number) {
            return `${this.goal}:${step}`
        },
        { kind: 'method', name: 'plan' } as ClassMethodDecoratorContext,
    )
    expect(await standard.call({ goal: 'ship' }, 1)).toBe('ship:1')

    const descriptor: PropertyDescriptor = {
        value: async function (this: { goal: string }) {
            return this.goal
        },
    }
    sdk.traced('chain', 'legacy-name')({}, 'run', descriptor)
    expect(await descriptor.value.call({ goal: 'done' })).toBe('done')

    const sent = await spans(2)
    expect(sent.map((s) => [s.span_type, s.span_name])).toEqual([
        ['agent', 'plan'],
        ['chain', 'legacy-name'],
    ])
})

test('wrapOpenAI adds the current trace headers to chat completion calls', async () => {
    const calls: any[] = []
    const client = sdk.wrapOpenAI({
        chat: {
            completions: {
                create: async (body: unknown, options?: { headers?: Record<string, string> }) => {
                    calls.push(options)
                    return body
                },
            },
        },
    })
    await sdk.trace('wrapped', () => client.chat.completions.create({}, { headers: { a: '1' } }))
    expect(calls[0].headers.a).toBe('1')
    expect(calls[0].headers['x-trace-id']).toMatch(/^[0-9a-f-]{36}$/)
})

test('generateId returns a UUID', () => {
    expect(sdk.generateId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
})
