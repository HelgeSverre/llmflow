import { afterAll, beforeAll, expect, test } from 'bun:test'
import { spanId, traceId } from './helpers/otlp-builders'
import { startTestServer } from './helpers/test-server'

const server = await startTestServer({ prefix: 'llmflow-otlp-logs-' })
afterAll(() => server.stop())

async function api(path: string, body?: unknown) {
    const response = await fetch(server.url + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, data: (await response.json().catch(() => null)) as any }
}

type Log = {
    body: string
    severityNumber: number
    severityText: string
    traceId?: string
    spanId?: string
    attributes: unknown[]
}

// Simulates what Claude Code, Codex CLI or Gemini CLI send.
function logsPayload(serviceName: string, logs: Log[]) {
    const now = Date.now()
    return {
        resourceLogs: [
            {
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: serviceName } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } },
                    ],
                },
                scopeLogs: [
                    {
                        scope: { name: serviceName, version: '1.0.0' },
                        logRecords: logs.map((log) => ({
                            timeUnixNano: String(now * 1000000),
                            observedTimeUnixNano: String(now * 1000000),
                            severityNumber: log.severityNumber,
                            severityText: log.severityText,
                            body: { stringValue: log.body },
                            attributes: log.attributes,
                            traceId: log.traceId || '',
                            spanId: log.spanId || '',
                        })),
                    },
                ],
            },
        ],
    }
}

const string = (key: string, value: string) => ({ key, value: { stringValue: value } })
const claudeTraceId = traceId()

beforeAll(async () => {
    const batches = [
        logsPayload('test-service', [
            {
                body: 'Test log message',
                severityNumber: 9,
                severityText: 'INFO',
                attributes: [string('event.name', 'test.simple_log')],
            },
        ]),
        logsPayload('claude-code', [
            {
                body: 'User prompt: Write a function to sort an array',
                severityNumber: 9,
                severityText: 'INFO',
                traceId: claudeTraceId,
                spanId: spanId(),
                attributes: [
                    string('event.name', 'claude_code.user_prompt'),
                    string('session_id', 'session-123'),
                    string('model', 'claude-sonnet-4-20250514'),
                ],
            },
            {
                body: 'Tool result: file_edit completed successfully',
                severityNumber: 9,
                severityText: 'INFO',
                traceId: claudeTraceId,
                attributes: [
                    string('event.name', 'claude_code.tool_result'),
                    string('tool_name', 'file_edit'),
                    { key: 'success', value: { boolValue: true } },
                ],
            },
        ]),
        logsPayload('codex-cli', [
            {
                body: 'Run started',
                severityNumber: 9,
                severityText: 'INFO',
                attributes: [
                    string('event.name', 'codex.run_started'),
                    string('call_id', 'call-456'),
                ],
            },
            {
                body: 'Tool decision: approve_all for shell command',
                severityNumber: 13,
                severityText: 'WARN',
                attributes: [
                    string('event.name', 'codex.tool_decision'),
                    string('decision', 'approve_all'),
                    string('tool_name', 'shell'),
                ],
            },
        ]),
    ]
    for (const payload of batches) {
        const result = await api('/v1/logs', payload)
        expect(result.status).toBe(200)
        expect(result.data.partialSuccess).toBeFalsy()
    }
})

test('a simple log is stored with its event and service name', async () => {
    const result = await api('/api/logs?service_name=test-service&limit=5')
    expect(result.status).toBe(200)
    expect(Array.isArray(result.data.logs)).toBe(true)
    const log = result.data.logs.find((row: any) => row.body === 'Test log message')
    expect(log).toMatchObject({ event_name: 'test.simple_log', service_name: 'test-service' })
})

test('Claude Code logs keep their trace id', async () => {
    const result = await api('/api/logs?service_name=claude-code&limit=10')
    expect(result.status).toBe(200)
    const prompt = result.data.logs.find((row: any) => row.event_name === 'claude_code.user_prompt')
    expect(prompt?.trace_id).toBe(claudeTraceId.toLowerCase())
})

test('Codex CLI logs keep their severity', async () => {
    const result = await api('/api/logs?service_name=codex-cli&limit=10')
    expect(result.status).toBe(200)
    const decision = result.data.logs.find((row: any) => row.event_name === 'codex.tool_decision')
    expect(decision?.severity_text).toBe('WARN')
})

test('a log is retrievable by id with parsed attributes', async () => {
    const [first] = (await api('/api/logs?limit=1')).data.logs
    expect(first).toBeDefined()
    const single = await api(`/api/logs/${first.id}`)
    expect(single.status).toBe(200)
    expect(single.data.id).toBe(first.id)
    expect(typeof single.data.attributes).toBe('object')
})

test('the event name filter returns only matching logs', async () => {
    const result = await api('/api/logs?event_name=claude_code.user_prompt')
    expect(result.status).toBe(200)
    expect(result.data.logs.length).toBeGreaterThan(0)
    for (const log of result.data.logs) expect(log.event_name).toBe('claude_code.user_prompt')
})

test('filter options list services and event names', async () => {
    const filters = await api('/api/logs/filters')
    expect(filters.status).toBe(200)
    expect(filters.data.services).toEqual(
        expect.arrayContaining(['test-service', 'claude-code', 'codex-cli']),
    )
    expect(Array.isArray(filters.data.event_names)).toBe(true)
})

test('an empty payload is accepted and an unknown id is a 404', async () => {
    expect((await api('/v1/logs', {})).status).toBe(200)
    expect((await api('/api/logs/nonexistent-id')).status).toBe(404)
})

test('pagination respects the limit and reports the total', async () => {
    const result = await api('/api/logs?limit=2&offset=0')
    expect(result.status).toBe(200)
    expect(result.data.logs).toHaveLength(2)
    expect(result.data.total).toBe(5)
})
