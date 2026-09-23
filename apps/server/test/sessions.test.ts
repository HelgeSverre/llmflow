import { afterAll, expect, test } from 'bun:test'
import { buildSpan, buildTracesPayload, postOtlp, spanId, traceId } from './helpers/otlp-builders'
import { startTestServer } from './helpers/test-server'

const server = await startTestServer({ prefix: 'llmflow-sessions-' })
afterAll(() => server.stop())

const sessionId = `e2e-${crypto.randomUUID()}`

test('three traces sharing a session.id are correlated into one session', async () => {
    for (const name of ['turn-1', 'turn-2', 'turn-3']) {
        const start = Date.now()
        const result = await postOtlp(
            server.url,
            '/v1/traces',
            buildTracesPayload({
                spans: [
                    buildSpan({
                        traceId: traceId(),
                        spanId: spanId(),
                        name,
                        startMs: start,
                        endMs: start + 100,
                        attributes: { 'session.id': sessionId },
                        status: { code: 1 },
                    }),
                ],
            }),
        )
        expect(result.status).toBe(200)
    }

    const list = await fetch(`${server.url}/api/sessions?limit=100`)
    expect(list.status).toBe(200)
    const { sessions } = (await list.json()) as { sessions: any[] }
    const session = sessions.find((row) => row.session_id === sessionId)
    expect(session?.trace_count).toBe(3)

    const detail = await fetch(`${server.url}/api/sessions/${sessionId}`)
    expect(detail.status).toBe(200)
    const { traces } = (await detail.json()) as { traces: any[] }
    expect(traces).toHaveLength(3)
    for (const trace of traces) {
        expect(trace.trace_id).toBeTruthy()
        expect(trace.started_at).toBeDefined()
    }
})
