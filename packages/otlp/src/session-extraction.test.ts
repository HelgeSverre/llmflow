import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// The database and pricing modules read their configuration on import, so the
// environment is set before importing them dynamically.
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-otlp-sessions-'))
process.env.DATA_DIR = directory
process.env.DB_PATH = path.join(directory, 'test.db')
process.env.PRICING_URL = 'https://127.0.0.1:1/pricing.json'
const db = await import('@llmflow/db')
const { processOtlpTraces } = await import('./traces')

afterAll(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
})

function randomId(length: number) {
    return Math.random().toString(36).slice(2).padEnd(length, '0')
}

// Ingests a single span with the given string attributes and returns its stored row.
function ingest(attributes: Record<string, string>) {
    const spanId = randomId(16)
    processOtlpTraces({
        resourceSpans: [
            {
                resource: { attributes: [] },
                scopeSpans: [
                    {
                        spans: [
                            {
                                traceId: randomId(32),
                                spanId,
                                name: 'test',
                                startTimeUnixNano: String(1700000000_000000000n),
                                endTimeUnixNano: String(1700000000_100000000n),
                                attributes: Object.entries(attributes).map(([key, value]) => ({
                                    key,
                                    value: { stringValue: value },
                                })),
                                status: { code: 1 },
                            },
                        ],
                    },
                ],
            },
        ],
    })
    return db.getTraceById(spanId)
}

test('OpenInference session.id', () => {
    expect(ingest({ 'session.id': 'sess-123' })?.session_id).toBe('sess-123')
})

test('LangSmith langsmith.trace.session_id', () => {
    expect(ingest({ 'langsmith.trace.session_id': 'ls-456' })?.session_id).toBe('ls-456')
})

test('Traceloop traceloop.association.properties.session_id', () => {
    const row = ingest({ 'traceloop.association.properties.session_id': 'tl-789' })
    expect(row?.session_id).toBe('tl-789')
})

test('Vercel AI SDK ai.telemetry.metadata.sessionId', () => {
    expect(ingest({ 'ai.telemetry.metadata.sessionId': 'v-321' })?.session_id).toBe('v-321')
})

test('Priority: session.id beats langsmith and traceloop', () => {
    const row = ingest({
        'session.id': 'winner',
        'langsmith.trace.session_id': 'loser-1',
        'traceloop.association.properties.session_id': 'loser-2',
    })
    expect(row?.session_id).toBe('winner')
})

test('Conversation: gen_ai.conversation.id wins over traceloop thread_id', () => {
    const row = ingest({
        'gen_ai.conversation.id': 'conv-A',
        'traceloop.association.properties.thread_id': 'conv-B',
    })
    expect(row?.conversation_id).toBe('conv-A')
})
