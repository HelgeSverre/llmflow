import { afterAll, expect, test } from 'bun:test'
import { startTestServer } from './helpers/test-server'

const server = await startTestServer({ prefix: 'llmflow-websocket-' })
const sockets: WebSocket[] = []
afterAll(async () => {
    for (const socket of sockets) socket.close()
    await server.stop()
})

type Message = { type: string; time?: number; payload?: any }

// Buffers every message from the moment the socket is created, so nothing
// sent between open and the first wait is lost.
function connect() {
    const socket = new WebSocket(server.url.replace(/^http/, 'ws') + '/ws', {
        headers: { Origin: server.url },
    } as any)
    sockets.push(socket)
    const messages: Message[] = []
    const waiters = new Set<() => void>()
    socket.addEventListener('message', (event) => {
        messages.push(JSON.parse(String(event.data)))
        for (const wake of waiters) wake()
    })
    const opened = new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true })
        socket.addEventListener('error', () => reject(new Error('WebSocket failed')), {
            once: true,
        })
    })
    function waitFor(match: (message: Message) => boolean, timeout = 3000) {
        return new Promise<Message | undefined>((resolve) => {
            const check = () => {
                const found = messages.find(match)
                if (!found) return
                cleanup()
                resolve(found)
            }
            const timer = setTimeout(() => {
                cleanup()
                resolve(undefined)
            }, timeout)
            const cleanup = () => {
                clearTimeout(timer)
                waiters.delete(check)
            }
            waiters.add(check)
            check()
        })
    }
    return { socket, messages, opened, waitFor }
}

async function insertSpan(span: Record<string, unknown>) {
    const response = await fetch(server.url + '/api/spans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start_time: Date.now(),
            status: 200,
            service_name: 'ws-test',
            ...span,
        }),
    })
    expect(response.ok).toBe(true)
}

const traceId = crypto.randomUUID()

test('a client connects and receives a hello with a timestamp', async () => {
    const client = connect()
    await client.opened
    const hello = await client.waitFor((message) => message.type === 'hello')
    expect(typeof hello?.time).toBe('number')
    client.socket.close()
})

test('a root span broadcasts new_span and new_trace', async () => {
    const client = connect()
    await client.opened
    await client.waitFor((message) => message.type === 'hello')
    const id = crypto.randomUUID()
    await insertSpan({
        id,
        trace_id: traceId,
        parent_id: null,
        span_type: 'llm',
        span_name: 'ws-test-span',
        duration_ms: 100,
        model: 'gpt-4o-mini',
        total_tokens: 500,
        estimated_cost: 0.001,
    })
    const span = await client.waitFor((m) => m.type === 'new_span' && m.payload?.id === id)
    expect(span?.payload).toMatchObject({ span_name: 'ws-test-span', model: 'gpt-4o-mini' })
    expect(
        await client.waitFor((m) => m.type === 'new_trace' && m.payload?.id === id),
    ).toBeDefined()
    // stats_update is throttled to one per second, so it may or may not arrive here.
    const stats = client.messages.find((message) => message.type === 'stats_update')
    if (stats) expect(typeof stats.payload?.request_count).toBe('number')
    client.socket.close()
})

test('a child span broadcasts new_span but no new_trace', async () => {
    const client = connect()
    await client.opened
    await client.waitFor((message) => message.type === 'hello')
    const id = crypto.randomUUID()
    await insertSpan({
        id,
        trace_id: traceId,
        parent_id: crypto.randomUUID(),
        span_type: 'tool',
        span_name: 'ws-child-span',
        duration_ms: 50,
    })
    const span = await client.waitFor((m) => m.type === 'new_span' && m.payload?.id === id)
    expect(span?.payload?.span_type).toBe('tool')
    expect(await client.waitFor((m) => m.type === 'new_trace' && m.payload?.id === id, 500)).toBe(
        undefined,
    )
    client.socket.close()
})

test('every connected client receives the broadcast', async () => {
    const clients = [connect(), connect()]
    await Promise.all(clients.map((client) => client.opened))
    await Promise.all(clients.map((client) => client.waitFor((m) => m.type === 'hello')))
    const id = crypto.randomUUID()
    await insertSpan({
        id,
        trace_id: crypto.randomUUID(),
        span_type: 'llm',
        span_name: 'multi-client-test',
        duration_ms: 10,
    })
    const received = await Promise.all(
        clients.map((client) =>
            client.waitFor((m) => m.type === 'new_span' && m.payload?.id === id),
        ),
    )
    expect(received.map(Boolean)).toEqual([true, true])
    for (const client of clients) client.socket.close()
})

test('a client can reconnect after closing', async () => {
    const first = connect()
    await first.opened
    first.socket.close()
    await new Promise<void>((resolve) => first.socket.addEventListener('close', () => resolve()))

    const second = connect()
    await second.opened
    expect(await second.waitFor((message) => message.type === 'hello')).toBeDefined()
    second.socket.close()
})
