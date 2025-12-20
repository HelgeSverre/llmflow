/**
 * Tests for OTLP Export Module
 */

const assert = require('assert');

// Colors for output
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(green(`✓ ${name}`));
        passed++;
    } catch (err) {
        console.log(red(`✗ ${name}`));
        console.log(`  ${err.message}`);
        failed++;
    }
}

// Import the module
const {
    traceToOtlpSpan,
    logToOtlpRecord,
    metricToOtlpMetric,
    buildTracesPayload,
    buildLogsPayload,
    buildMetricsPayload,
    getConfig
} = require('../otlp-export');

console.log('\n=== OTLP Export Tests ===\n');

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
        span_name: 'chat.completions'
    };
    
    const span = traceToOtlpSpan(trace);
    
    assert.ok(span.traceId, 'should have traceId');
    assert.ok(span.spanId, 'should have spanId');
    assert.strictEqual(span.name, 'chat.completions', 'should have correct name');
    assert.strictEqual(span.kind, 3, 'should be SPAN_KIND_CLIENT');
    assert.ok(span.startTimeUnixNano, 'should have start time');
    assert.ok(span.endTimeUnixNano, 'should have end time');
    assert.ok(span.attributes.length > 0, 'should have attributes');
});

test('traceToOtlpSpan normalizes trace ID to 32 chars', () => {
    const trace = {
        id: 'short-id',
        trace_id: 'abc',
        timestamp: Date.now()
    };
    
    const span = traceToOtlpSpan(trace);
    
    assert.strictEqual(span.traceId.length, 32, 'traceId should be 32 chars');
    assert.strictEqual(span.spanId.length, 16, 'spanId should be 16 chars');
});

test('traceToOtlpSpan handles UUID format', () => {
    const trace = {
        id: 'abc12345-6789-0abc-def1-234567890abc',
        trace_id: 'trace123-4567-89ab-cdef-0123456789ab',
        timestamp: Date.now()
    };
    
    const span = traceToOtlpSpan(trace);
    
    // Should strip dashes and normalize
    assert.ok(!span.traceId.includes('-'), 'traceId should not have dashes');
    assert.ok(!span.spanId.includes('-'), 'spanId should not have dashes');
});

test('traceToOtlpSpan extracts gen_ai attributes', () => {
    const trace = {
        id: 'test',
        timestamp: Date.now(),
        provider: 'anthropic',
        model: 'claude-3-haiku',
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150
    };
    
    const span = traceToOtlpSpan(trace);
    
    const attrMap = Object.fromEntries(
        span.attributes.map(a => [a.key, a.value])
    );
    
    assert.strictEqual(attrMap['gen_ai.system'].stringValue, 'anthropic');
    assert.strictEqual(attrMap['gen_ai.request.model'].stringValue, 'claude-3-haiku');
    assert.strictEqual(attrMap['gen_ai.usage.prompt_tokens'].intValue, '50');
    assert.strictEqual(attrMap['gen_ai.usage.completion_tokens'].intValue, '100');
});

// Test log conversion
test('logToOtlpRecord converts basic log', () => {
    const log = {
        timestamp: 1700000000000,
        severity_number: 9,
        severity_text: 'INFO',
        body: 'Test log message',
        event_name: 'test.event',
        trace_id: 'trace-123',
        span_id: 'span-456'
    };
    
    const record = logToOtlpRecord(log);
    
    assert.ok(record.timeUnixNano, 'should have time');
    assert.strictEqual(record.severityNumber, 9);
    assert.strictEqual(record.severityText, 'INFO');
    assert.strictEqual(record.body.stringValue, 'Test log message');
});

test('logToOtlpRecord extracts attributes', () => {
    const log = {
        timestamp: Date.now(),
        event_name: 'claude_code.prompt',
        attributes: {
            model: 'claude-3-haiku',
            tokens: 150,
            cached: true
        }
    };
    
    const record = logToOtlpRecord(log);
    
    const attrMap = Object.fromEntries(
        record.attributes.map(a => [a.key, a.value])
    );
    
    assert.strictEqual(attrMap['event.name'].stringValue, 'claude_code.prompt');
    assert.strictEqual(attrMap['model'].stringValue, 'claude-3-haiku');
    assert.strictEqual(attrMap['tokens'].doubleValue, 150);
    assert.strictEqual(attrMap['cached'].boolValue, true);
});

// Test metric conversion
test('metricToOtlpMetric converts gauge metric', () => {
    const metric = {
        name: 'llm.latency',
        timestamp: Date.now(),
        metric_type: 'gauge',
        value_double: 1.5,
        description: 'LLM request latency',
        unit: 's'
    };
    
    const otlpMetric = metricToOtlpMetric(metric);
    
    assert.strictEqual(otlpMetric.name, 'llm.latency');
    assert.strictEqual(otlpMetric.description, 'LLM request latency');
    assert.strictEqual(otlpMetric.unit, 's');
    assert.ok(otlpMetric.gauge, 'should have gauge data');
    assert.strictEqual(otlpMetric.gauge.dataPoints[0].asDouble, 1.5);
});

test('metricToOtlpMetric converts sum metric', () => {
    const metric = {
        name: 'llm.requests.count',
        timestamp: Date.now(),
        metric_type: 'sum',
        value_int: 42
    };
    
    const otlpMetric = metricToOtlpMetric(metric);
    
    assert.ok(otlpMetric.sum, 'should have sum data');
    assert.strictEqual(otlpMetric.sum.dataPoints[0].asInt, '42');
    assert.strictEqual(otlpMetric.sum.isMonotonic, true);
});

test('metricToOtlpMetric converts histogram metric', () => {
    const metric = {
        name: 'llm.token_distribution',
        timestamp: Date.now(),
        metric_type: 'histogram',
        histogram_data: {
            count: 100,
            sum: 5000,
            bucketCounts: [10, 30, 40, 20],
            explicitBounds: [50, 100, 200]
        }
    };
    
    const otlpMetric = metricToOtlpMetric(metric);
    
    assert.ok(otlpMetric.histogram, 'should have histogram data');
    assert.strictEqual(otlpMetric.histogram.dataPoints[0].count, 100);
    assert.strictEqual(otlpMetric.histogram.dataPoints[0].sum, 5000);
});

// Test payload builders
test('buildTracesPayload creates valid OTLP structure', () => {
    const traces = [
        { id: 't1', timestamp: Date.now(), model: 'gpt-4' },
        { id: 't2', timestamp: Date.now(), model: 'claude-3' }
    ];
    
    const payload = buildTracesPayload(traces);
    
    assert.ok(payload.resourceSpans, 'should have resourceSpans');
    assert.strictEqual(payload.resourceSpans.length, 1);
    assert.ok(payload.resourceSpans[0].resource.attributes, 'should have resource attributes');
    assert.ok(payload.resourceSpans[0].scopeSpans, 'should have scopeSpans');
    assert.strictEqual(payload.resourceSpans[0].scopeSpans[0].spans.length, 2);
});

test('buildLogsPayload creates valid OTLP structure', () => {
    const logs = [
        { timestamp: Date.now(), body: 'Log 1' },
        { timestamp: Date.now(), body: 'Log 2' }
    ];
    
    const payload = buildLogsPayload(logs);
    
    assert.ok(payload.resourceLogs, 'should have resourceLogs');
    assert.strictEqual(payload.resourceLogs.length, 1);
    assert.ok(payload.resourceLogs[0].scopeLogs, 'should have scopeLogs');
    assert.strictEqual(payload.resourceLogs[0].scopeLogs[0].logRecords.length, 2);
});

test('buildMetricsPayload creates valid OTLP structure', () => {
    const metrics = [
        { name: 'm1', timestamp: Date.now(), metric_type: 'gauge', value_int: 1 },
        { name: 'm2', timestamp: Date.now(), metric_type: 'sum', value_int: 2 }
    ];
    
    const payload = buildMetricsPayload(metrics);
    
    assert.ok(payload.resourceMetrics, 'should have resourceMetrics');
    assert.strictEqual(payload.resourceMetrics.length, 1);
    assert.ok(payload.resourceMetrics[0].scopeMetrics, 'should have scopeMetrics');
    assert.strictEqual(payload.resourceMetrics[0].scopeMetrics[0].metrics.length, 2);
});

// Test config
test('getConfig returns configuration object', () => {
    const config = getConfig();
    
    assert.ok('enabled' in config, 'should have enabled');
    assert.ok('endpoints' in config, 'should have endpoints');
    assert.ok('batchSize' in config, 'should have batchSize');
    assert.ok('flushIntervalMs' in config, 'should have flushIntervalMs');
});

// Summary
console.log('\n---');
console.log(`Tests: ${passed + failed} total, ${green(passed + ' passed')}, ${failed > 0 ? red(failed + ' failed') : '0 failed'}`);

if (failed > 0) {
    process.exit(1);
}
