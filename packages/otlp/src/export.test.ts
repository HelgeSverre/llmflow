import { expect, test } from 'bun:test'

// export.js reads LLMFLOW_OTLP_LEGACY_ATTRS on import; these tests expect the default (current names only).
delete process.env.LLMFLOW_OTLP_LEGACY_ATTRS
const {
    traceToOtlpSpan,
    logToOtlpRecord,
    metricToOtlpMetric,
    buildTracesPayload,
    buildLogsPayload,
    buildMetricsPayload,
    getConfig,
} = await import('./export')

// Test trace conversion
test('traceToOtlpSpan converts basic trace', () => {
    const trace = {
        id: 'abc123',
        trace_id: 'trace-abc-123',
        timestamp: 1700000000000,
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
    }

    const span = traceToOtlpSpan(trace)

    expect(span.traceId).toBeTruthy()
    expect(span.spanId).toBeTruthy()
    expect(span.name).toBe('chat.completions')
    expect(span.kind).toBe(3)
    expect(span.startTimeUnixNano).toBeTruthy()
    expect(span.endTimeUnixNano).toBeTruthy()
    expect(span.attributes.length).toBeGreaterThan(0)
})

test('traceToOtlpSpan normalizes trace ID to 32 chars', () => {
    const trace = {
        id: 'short-id',
        trace_id: 'abc',
        timestamp: Date.now(),
    }

    const span = traceToOtlpSpan(trace)

    expect(span.traceId).toHaveLength(32)
    expect(span.spanId).toHaveLength(16)
})

test('traceToOtlpSpan handles UUID format', () => {
    const trace = {
        id: 'abc12345-6789-0abc-def1-234567890abc',
        trace_id: 'trace123-4567-89ab-cdef-0123456789ab',
        timestamp: Date.now(),
    }

    const span = traceToOtlpSpan(trace)

    // Should strip dashes and normalize
    expect(span.traceId.includes('-')).toBeFalsy()
    expect(span.spanId.includes('-')).toBeFalsy()
})

test('traceToOtlpSpan extracts gen_ai attributes', () => {
    const trace = {
        id: 'test',
        timestamp: Date.now(),
        provider: 'anthropic',
        model: 'claude-3-haiku',
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150,
    }

    const span = traceToOtlpSpan(trace)

    const attrMap = Object.fromEntries(span.attributes.map((a) => [a.key, a.value]))

    // Export emits current OTel GenAI semconv names by default
    expect(attrMap['gen_ai.provider.name'].stringValue).toBe('anthropic')
    expect(attrMap['gen_ai.operation.name'].stringValue).toBe('chat')
    expect(attrMap['gen_ai.request.model'].stringValue).toBe('claude-3-haiku')
    expect(attrMap['gen_ai.usage.input_tokens'].intValue).toBe('50')
    expect(attrMap['gen_ai.usage.output_tokens'].intValue).toBe('100')
    // Deprecated names are NOT emitted unless LLMFLOW_OTLP_LEGACY_ATTRS=1
    expect(attrMap['gen_ai.system']).toBeUndefined()
    expect(attrMap['gen_ai.usage.prompt_tokens']).toBeUndefined()
})

// Test log conversion
test('logToOtlpRecord converts basic log', () => {
    const log = {
        timestamp: 1700000000000,
        severity_number: 9,
        severity_text: 'INFO',
        body: 'Test log message',
        event_name: 'test.event',
        trace_id: 'trace-123',
        span_id: 'span-456',
    }

    const record = logToOtlpRecord(log)

    expect(record.timeUnixNano).toBeTruthy()
    expect(record.severityNumber).toBe(9)
    expect(record.severityText).toBe('INFO')
    expect(record.body.stringValue).toBe('Test log message')
})

test('logToOtlpRecord extracts attributes', () => {
    const log = {
        timestamp: Date.now(),
        event_name: 'claude_code.prompt',
        attributes: {
            model: 'claude-3-haiku',
            tokens: 150,
            cached: true,
        },
    }

    const record = logToOtlpRecord(log)

    const attrMap = Object.fromEntries(record.attributes.map((a) => [a.key, a.value]))

    expect(attrMap['event.name'].stringValue).toBe('claude_code.prompt')
    expect(attrMap['model'].stringValue).toBe('claude-3-haiku')
    expect(attrMap['tokens'].doubleValue).toBe(150)
    expect(attrMap['cached'].boolValue).toBe(true)
})

// Test metric conversion
test('metricToOtlpMetric converts gauge metric', () => {
    const metric = {
        name: 'llm.latency',
        timestamp: Date.now(),
        metric_type: 'gauge',
        value_double: 1.5,
        description: 'LLM request latency',
        unit: 's',
    }

    const otlpMetric = metricToOtlpMetric(metric)

    expect(otlpMetric.name).toBe('llm.latency')
    expect(otlpMetric.description).toBe('LLM request latency')
    expect(otlpMetric.unit).toBe('s')
    expect(otlpMetric.gauge).toBeTruthy()
    expect(otlpMetric.gauge.dataPoints[0].asDouble).toBe(1.5)
})

test('metricToOtlpMetric converts sum metric', () => {
    const metric = {
        name: 'llm.requests.count',
        timestamp: Date.now(),
        metric_type: 'sum',
        value_int: 42,
    }

    const otlpMetric = metricToOtlpMetric(metric)

    expect(otlpMetric.sum).toBeTruthy()
    expect(otlpMetric.sum.dataPoints[0].asInt).toBe('42')
    expect(otlpMetric.sum.isMonotonic).toBe(true)
})

test('metricToOtlpMetric converts histogram metric', () => {
    const metric = {
        name: 'llm.token_distribution',
        timestamp: Date.now(),
        metric_type: 'histogram',
        histogram_data: {
            count: 100,
            sum: 5000,
            bucketCounts: [10, 30, 40, 20],
            explicitBounds: [50, 100, 200],
        },
    }

    const otlpMetric = metricToOtlpMetric(metric)

    expect(otlpMetric.histogram).toBeTruthy()
    expect(otlpMetric.histogram.dataPoints[0].count).toBe(100)
    expect(otlpMetric.histogram.dataPoints[0].sum).toBe(5000)
})

// Test payload builders
test('buildTracesPayload creates valid OTLP structure', () => {
    const traces = [
        { id: 't1', timestamp: Date.now(), model: 'gpt-4' },
        { id: 't2', timestamp: Date.now(), model: 'claude-3' },
    ]

    const payload = buildTracesPayload(traces)

    expect(payload.resourceSpans).toBeTruthy()
    expect(payload.resourceSpans).toHaveLength(1)
    expect(payload.resourceSpans[0].resource.attributes).toBeTruthy()
    expect(payload.resourceSpans[0].scopeSpans).toBeTruthy()
    expect(payload.resourceSpans[0].scopeSpans[0].spans).toHaveLength(2)
})

test('buildLogsPayload creates valid OTLP structure', () => {
    const logs = [
        { timestamp: Date.now(), body: 'Log 1' },
        { timestamp: Date.now(), body: 'Log 2' },
    ]

    const payload = buildLogsPayload(logs)

    expect(payload.resourceLogs).toBeTruthy()
    expect(payload.resourceLogs).toHaveLength(1)
    expect(payload.resourceLogs[0].scopeLogs).toBeTruthy()
    expect(payload.resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(2)
})

test('buildMetricsPayload creates valid OTLP structure', () => {
    const metrics = [
        { name: 'm1', timestamp: Date.now(), metric_type: 'gauge', value_int: 1 },
        { name: 'm2', timestamp: Date.now(), metric_type: 'sum', value_int: 2 },
    ]

    const payload = buildMetricsPayload(metrics)

    expect(payload.resourceMetrics).toBeTruthy()
    expect(payload.resourceMetrics).toHaveLength(1)
    expect(payload.resourceMetrics[0].scopeMetrics).toBeTruthy()
    expect(payload.resourceMetrics[0].scopeMetrics[0].metrics).toHaveLength(2)
})

// Test config
test('getConfig returns configuration object', () => {
    const config = getConfig()

    expect(config).toHaveProperty('enabled')
    expect(config).toHaveProperty('endpoints')
    expect(config).toHaveProperty('batchSize')
    expect(config).toHaveProperty('flushIntervalMs')
})
