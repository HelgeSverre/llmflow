const assert = require('node:assert');
const { processOtlpTraces } = require('@llmflow/otlp/traces');
const db = require('@llmflow/db');

function makeSpan(attrs) {
    return {
        resourceSpans: [{
            resource: { attributes: [] },
            scopeSpans: [{
                spans: [{
                    traceId: Math.random().toString(36).slice(2).padEnd(32, '0'),
                    spanId: Math.random().toString(36).slice(2).padEnd(16, '0'),
                    name: 'test',
                    startTimeUnixNano: String(1700000000_000000000n),
                    endTimeUnixNano: String(1700000000_100000000n),
                    attributes: Object.entries(attrs).map(([k, v]) => ({ key: k, value: { stringValue: String(v) } })),
                    status: { code: 1 }
                }]
            }]
        }]
    };
}

function lastTraceFor(id) {
    return db.getTraceById(id);
}

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✓', name); passed++; }
    catch (e) { console.log('✗', name, '—', e.message); failed++; }
}

test('OpenInference session.id', () => {
    const payload = makeSpan({ 'session.id': 'sess-123' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'sess-123');
});

test('LangSmith langsmith.trace.session_id', () => {
    const payload = makeSpan({ 'langsmith.trace.session_id': 'ls-456' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'ls-456');
});

test('Traceloop traceloop.association.properties.session_id', () => {
    const payload = makeSpan({ 'traceloop.association.properties.session_id': 'tl-789' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'tl-789');
});

test('Vercel AI SDK ai.telemetry.metadata.sessionId', () => {
    const payload = makeSpan({ 'ai.telemetry.metadata.sessionId': 'v-321' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'v-321');
});

test('Priority: session.id beats langsmith and traceloop', () => {
    const payload = makeSpan({
        'session.id': 'winner',
        'langsmith.trace.session_id': 'loser-1',
        'traceloop.association.properties.session_id': 'loser-2'
    });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'winner');
});

test('Conversation: gen_ai.conversation.id wins over traceloop thread_id', () => {
    const payload = makeSpan({
        'gen_ai.conversation.id': 'conv-A',
        'traceloop.association.properties.thread_id': 'conv-B'
    });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.conversation_id, 'conv-A');
});

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
