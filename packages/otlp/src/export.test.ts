import { expect, test } from 'bun:test'
import type { Log, Metric, Trace } from '@llmflow/db'

// export.ts reads LLMFLOW_OTLP_LEGACY_ATTRS on import; these tests expect the default (current names only).
delete process.env.LLMFLOW_OTLP_LEGACY_ATTRS
const {
    traceToOtlpSpan,
    logToOtlpRecord,
    metricToOtlpMetric,
    buildTracesPayload,
    buildLogsPayload,
    buildMetricsPayload,
    encodePayload,
    getConfig,
} = await import('./export')
const { messageType } = await import('./transport')

const trace = (fields: Partial<Trace>): Trace => ({
    id: 'test',
    timestamp: 1700000000000,
    ...fields,
})
const logEntry = (fields: Partial<Log>): Log => ({ id: 'log', timestamp: 1700000000000, ...fields })
const metric = (fields: Partial<Metric>): Metric => ({
    id: 'metric',
    timestamp: 1700000000000,
    name: 'm',
    ...fields,
})
const attributeMap = (attributes: { key: string; value?: Record<string, unknown> }[]) =>
    Object.fromEntries(attributes.map(({ key, value }) => [key, value ?? {}]))

test('traceToOtlpSpan converts basic trace', () => {
    const span = traceToOtlpSpan(
        trace({
            id: 'abc123',
            trace_id: 'trace-abc-123',
            duration_ms: 1500,
            provider: 'openai',
            model: 'gpt-4o-mini',
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300,
            estimated_cost: 0.05,
            status: 200,
            span_type: 'llm',
            span_name: 'chat.completions',
        }),
    )
    expect(span.traceId).toBeTruthy()
    expect(span.spanId).toBeTruthy()
    expect(span.name).toBe('chat.completions')
    expect(span.kind).toBe(3)
    expect(span.startTimeUnixNano).toBe('1700000000000000000')
    expect(span.endTimeUnixNano).toBe('1700000001500000000')
    expect(span.attributes.length).toBeGreaterThan(0)
})

test('traceToOtlpSpan normalizes IDs to 32 and 16 hex chars without dashes', () => {
    const short = traceToOtlpSpan(trace({ id: 'short-id', trace_id: 'abc' }))
    expect(short.traceId).toHaveLength(32)
    expect(short.spanId).toHaveLength(16)
    const uuid = traceToOtlpSpan(
        trace({
            id: 'abc12345-6789-0abc-def1-234567890abc',
            trace_id: 'trace123-4567-89ab-cdef-0123456789ab',
        }),
    )
    expect(uuid.traceId.includes('-')).toBeFalsy()
    expect(uuid.spanId.includes('-')).toBeFalsy()
})

test('traceToOtlpSpan emits current gen_ai attribute names only', () => {
    const attrs = attributeMap(
        traceToOtlpSpan(
            trace({
                provider: 'anthropic',
                model: 'claude-3-haiku',
                prompt_tokens: 50,
                completion_tokens: 100,
                total_tokens: 150,
            }),
        ).attributes,
    )
    expect(attrs['gen_ai.provider.name']!.stringValue).toBe('anthropic')
    expect(attrs['gen_ai.operation.name']!.stringValue).toBe('chat')
    expect(attrs['gen_ai.request.model']!.stringValue).toBe('claude-3-haiku')
    expect(attrs['gen_ai.usage.input_tokens']!.intValue).toBe('50')
    expect(attrs['gen_ai.usage.output_tokens']!.intValue).toBe('100')
    expect(attrs['gen_ai.system']).toBeUndefined()
    expect(attrs['gen_ai.usage.prompt_tokens']).toBeUndefined()
})

test('traceToOtlpSpan forwards session, conversation, agent and the span attributes', () => {
    const span = traceToOtlpSpan(
        trace({
            session_id: 'sess-1',
            conversation_id: 'conv-1',
            agent_name: 'planner',
            provider: 'openai',
            attributes: {
                'gen_ai.provider.name': 'shadowed',
                'user.id': 'u-7',
                'gen_ai.usage.cache_read.input_tokens': 12,
                retries: 1.5,
                empty: null,
                _spanName: 'internal',
                otel_span_kind: 1,
            },
        }),
    )
    const attrs = attributeMap(span.attributes)
    expect(attrs['session.id']!.stringValue).toBe('sess-1')
    expect(attrs['gen_ai.conversation.id']!.stringValue).toBe('conv-1')
    expect(attrs['gen_ai.agent.name']!.stringValue).toBe('planner')
    expect(attrs['user.id']!.stringValue).toBe('u-7')
    expect(attrs['gen_ai.usage.cache_read.input_tokens']!.intValue).toBe('12')
    expect(attrs['retries']!.doubleValue).toBe(1.5)
    // Stored columns win over same-named attributes; internal keys and nulls are dropped.
    expect(attrs['gen_ai.provider.name']!.stringValue).toBe('openai')
    expect(span.attributes.filter(({ key }) => key === 'gen_ai.provider.name')).toHaveLength(1)
    expect(attrs['_spanName']).toBeUndefined()
    expect(attrs['otel_span_kind']).toBeUndefined()
    expect(attrs['empty']).toBeUndefined()
    // The original span kind survives (1 = INTERNAL).
    expect(span.kind).toBe(1)
})

test('logToOtlpRecord converts basic log', () => {
    const record = logToOtlpRecord(
        logEntry({
            severity_number: 9,
            severity_text: 'INFO',
            body: 'Test log message',
            event_name: 'test.event',
            trace_id: 'trace-123',
            span_id: 'span-456',
        }),
    )
    expect(record.timeUnixNano).toBe('1700000000000000000')
    expect(record.severityNumber).toBe(9)
    expect(record.severityText).toBe('INFO')
    expect(record.body?.stringValue).toBe('Test log message')
})

test('logToOtlpRecord exports attributes with integer, double and boolean types', () => {
    const attrs = attributeMap(
        logToOtlpRecord(
            logEntry({
                event_name: 'claude_code.prompt',
                attributes: { model: 'claude-3-haiku', tokens: 150, ratio: 0.5, cached: true },
            }),
        ).attributes,
    )
    expect(attrs['event.name']!.stringValue).toBe('claude_code.prompt')
    expect(attrs['model']!.stringValue).toBe('claude-3-haiku')
    expect(attrs['tokens']!.intValue).toBe('150')
    expect(attrs['ratio']!.doubleValue).toBe(0.5)
    expect(attrs['cached']!.boolValue).toBe(true)
})

test('metricToOtlpMetric converts gauge, sum and histogram metrics', () => {
    const gauge = metricToOtlpMetric(
        metric({
            name: 'llm.latency',
            metric_type: 'gauge',
            value_double: 1.5,
            description: 'LLM request latency',
            unit: 's',
        }),
    )
    expect(gauge.name).toBe('llm.latency')
    expect(gauge.description).toBe('LLM request latency')
    expect(gauge.unit).toBe('s')
    expect(gauge.gauge!.dataPoints[0]!.asDouble).toBe(1.5)

    const sum = metricToOtlpMetric(metric({ metric_type: 'sum', value_int: 42 }))
    expect(sum.sum!.dataPoints[0]!.asInt).toBe('42')
    expect(sum.sum!.isMonotonic).toBe(true)

    const histogram = metricToOtlpMetric(
        metric({
            metric_type: 'histogram',
            histogram_data: {
                count: 100,
                sum: 5000,
                bucketCounts: [10, 30, 40, 20],
                explicitBounds: [50, 100, 200],
            },
        }),
    )
    expect(histogram.histogram!.dataPoints[0]!.count).toBe(100)
    expect(histogram.histogram!.dataPoints[0]!.sum).toBe(5000)
})

test('payload builders group records by resource and scope', () => {
    const traces = buildTracesPayload([
        trace({ id: 't1', model: 'gpt-4' }),
        trace({ id: 't2', model: 'claude-3' }),
    ])
    expect(traces.resourceSpans).toHaveLength(1)
    expect(traces.resourceSpans[0]!.resource.attributes).toBeTruthy()
    expect(traces.resourceSpans[0]!.scopeSpans[0]!.spans).toHaveLength(2)

    const logs = buildLogsPayload([
        logEntry({ body: 'Log 1' }),
        logEntry({ body: 'Log 2', service_name: 'other' }),
    ])
    expect(logs.resourceLogs).toHaveLength(2)
    expect(logs.resourceLogs[0]!.scopeLogs[0]!.logRecords).toHaveLength(1)

    const metrics = buildMetricsPayload([
        metric({ name: 'm1', metric_type: 'gauge', value_int: 1 }),
        metric({ name: 'm2', metric_type: 'sum', value_int: 2 }),
    ])
    expect(metrics.resourceMetrics).toHaveLength(1)
    expect(metrics.resourceMetrics[0]!.scopeMetrics[0]!.metrics).toHaveLength(2)
})

test('protobuf encoding keeps IDs, 64-bit timestamps and forwarded attributes', () => {
    const payload = buildTracesPayload([
        trace({
            id: 'b7ad6b7169203331',
            trace_id: '0af7651916cd43dd8448eb211c80319c',
            timestamp: 1750000000123,
            duration_ms: 5,
            session_id: 'sess-9',
        }),
    ])
    const { contentType, body } = encodePayload('traces', payload, 'http/protobuf')
    expect(contentType).toBe('application/x-protobuf')
    const type = messageType('trace', 'Request')
    const decoded = type.toObject(type.decode(body as Buffer), {
        longs: String,
        bytes: String,
    }) as any
    const span = decoded.resourceSpans[0].scopeSpans[0].spans[0]
    expect(Buffer.from(span.traceId, 'base64').toString('hex')).toBe(
        '0af7651916cd43dd8448eb211c80319c',
    )
    expect(Buffer.from(span.spanId, 'base64').toString('hex')).toBe('b7ad6b7169203331')
    expect(span.startTimeUnixNano).toBe('1750000000123000000')
    expect(span.endTimeUnixNano).toBe('1750000000128000000')
    expect(span.attributes.find((a: any) => a.key === 'session.id').value.stringValue).toBe(
        'sess-9',
    )
})

test('JSON encoding is the default wire format', () => {
    const { contentType, body } = encodePayload(
        'logs',
        buildLogsPayload([logEntry({ body: 'x' })]),
        'http/json',
    )
    expect(contentType).toBe('application/json')
    expect(JSON.parse(body as string).resourceLogs).toHaveLength(1)
})

test('getConfig reports protocol and endpoints', () => {
    const config = getConfig()
    expect(config.protocol).toBe('http/json')
    expect(config).toHaveProperty('enabled')
    expect(config).toHaveProperty('endpoints')
    expect(config).toHaveProperty('batchSize')
    expect(config).toHaveProperty('flushIntervalMs')
})
