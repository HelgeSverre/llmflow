/**
 * Shared OTLP/HTTP JSON builders for tests and the demo.
 *
 * Produces payloads that match the OTel spec for traces, logs, and metrics,
 * with helpers for both the current GenAI semconv (gen_ai.provider.name,
 * gen_ai.usage.input_tokens, gen_ai.input.messages, etc.) and the deprecated
 * v1.36.0 names (gen_ai.system, prompt_tokens, gen_ai.prompt) so the demo
 * and e2e tests can exercise the dual-read path in
 * packages/otlp/src/traces.js.
 *
 * Spec references:
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/
 */

const http = require('http')

// ────────────────────────────────────────────────────────────────────────────
// ID + time helpers
// ────────────────────────────────────────────────────────────────────────────

const HEX = '0123456789abcdef'

function generateHexId(length = 32) {
    let out = ''
    for (let i = 0; i < length; i++) out += HEX[(Math.random() * 16) | 0]
    return out
}

function traceId() {
    return generateHexId(32)
}

function spanId() {
    return generateHexId(16)
}

function msToNano(ms) {
    return String(BigInt(Math.floor(ms)) * 1_000_000n)
}

// OTel SpanKind enum (subset)
const SpanKind = {
    UNSPECIFIED: 0,
    INTERNAL: 1,
    SERVER: 2,
    CLIENT: 3,
    PRODUCER: 4,
    CONSUMER: 5,
}

// ────────────────────────────────────────────────────────────────────────────
// OTLP value encoding
// ────────────────────────────────────────────────────────────────────────────

/**
 * Wrap a JS value as an OTLP AnyValue. Detects type automatically.
 * Arrays of mixed primitives are encoded as arrayValue; objects fall back to
 * JSON-encoded stringValue (the spec's escape hatch for nested structures
 * that don't have a native AnyValue representation).
 */
function anyValue(v) {
    if (v === null || v === undefined) return { stringValue: '' }
    if (typeof v === 'string') return { stringValue: v }
    if (typeof v === 'boolean') return { boolValue: v }
    if (typeof v === 'number') {
        if (Number.isInteger(v)) return { intValue: String(v) }
        return { doubleValue: v }
    }
    if (Array.isArray(v)) {
        return { arrayValue: { values: v.map(anyValue) } }
    }
    if (typeof v === 'object') {
        // Spec allows kvlistValue but most ingesters treat structured payloads
        // (messages, tool args) as JSON strings. The transform layer in
        // traces.js parses these back via parseMaybeJson().
        return { stringValue: JSON.stringify(v) }
    }
    return { stringValue: String(v) }
}

/**
 * Convert a flat {key: value} object into an OTLP KeyValue[] array.
 */
function kvs(obj) {
    return Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => ({ key, value: anyValue(value) }))
}

// ────────────────────────────────────────────────────────────────────────────
// Span + payload builders
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a single OTLP span object.
 *
 * spec: {
 *   name, kind, traceId, spanId, parentSpanId?, startMs, endMs,
 *   attributes: {key: value, ...}, events?: [{name, ms, attributes}],
 *   status?: {code: 0|1|2, message?}
 * }
 */
function buildSpan(spec) {
    const span = {
        traceId: spec.traceId,
        spanId: spec.spanId,
        name: spec.name,
        kind: spec.kind ?? SpanKind.INTERNAL,
        startTimeUnixNano: msToNano(spec.startMs),
        endTimeUnixNano: msToNano(spec.endMs),
        attributes: kvs(spec.attributes || {}),
    }
    if (spec.parentSpanId) span.parentSpanId = spec.parentSpanId
    if (spec.events && spec.events.length > 0) {
        span.events = spec.events.map((e) => ({
            name: e.name,
            timeUnixNano: msToNano(e.ms ?? spec.startMs),
            attributes: kvs(e.attributes || {}),
        }))
    }
    if (spec.status) {
        span.status = { code: spec.status.code }
        if (spec.status.message) span.status.message = spec.status.message
    }
    return span
}

/**
 * Wrap built spans in a complete OTLP/HTTP JSON resourceSpans payload.
 */
function buildTracesPayload({ serviceName = 'llmflow-demo', scopeName = 'llmflow.demo', spans }) {
    return {
        resourceSpans: [
            {
                resource: {
                    attributes: kvs({
                        'service.name': serviceName,
                        'service.version': '0.0.0-demo',
                    }),
                },
                scopeSpans: [
                    {
                        scope: { name: scopeName, version: '1.0.0' },
                        spans,
                    },
                ],
            },
        ],
    }
}

/**
 * Wrap log records in a complete OTLP/HTTP JSON resourceLogs payload.
 *
 * logSpec: {
 *   ms, severityNumber?, body, traceId?, spanId?, attributes
 * }
 */
function buildLogsPayload({
    serviceName = 'llmflow-demo',
    scopeName = 'llmflow.demo',
    logRecords,
}) {
    return {
        resourceLogs: [
            {
                resource: {
                    attributes: kvs({
                        'service.name': serviceName,
                        'service.version': '0.0.0-demo',
                    }),
                },
                scopeLogs: [
                    {
                        scope: { name: scopeName, version: '1.0.0' },
                        logRecords: logRecords.map((r) => ({
                            timeUnixNano: msToNano(r.ms ?? Date.now()),
                            observedTimeUnixNano: msToNano(r.ms ?? Date.now()),
                            severityNumber: r.severityNumber ?? 9, // INFO
                            severityText: r.severityText ?? 'INFO',
                            body: anyValue(r.body ?? ''),
                            attributes: kvs(r.attributes || {}),
                            traceId: r.traceId,
                            spanId: r.spanId,
                        })),
                    },
                ],
            },
        ],
    }
}

/**
 * Wrap metric data points in a complete OTLP/HTTP JSON resourceMetrics payload.
 *
 * metric: { name, unit, description?, histogram?: {dataPoints: [...]},
 *           sum?: {dataPoints, isMonotonic, aggregationTemporality} }
 */
function buildMetricsPayload({
    serviceName = 'llmflow-demo',
    scopeName = 'llmflow.demo',
    metrics,
}) {
    return {
        resourceMetrics: [
            {
                resource: {
                    attributes: kvs({
                        'service.name': serviceName,
                        'service.version': '0.0.0-demo',
                    }),
                },
                scopeMetrics: [{ scope: { name: scopeName, version: '1.0.0' }, metrics }],
            },
        ],
    }
}

/**
 * Build a histogram metric (the primary GenAI metric instrument type).
 */
function buildHistogramMetric({ name, unit, description, dataPoints }) {
    return {
        name,
        unit,
        description,
        histogram: {
            aggregationTemporality: 2, // CUMULATIVE
            dataPoints: dataPoints.map((dp) => ({
                startTimeUnixNano: msToNano(dp.startMs),
                timeUnixNano: msToNano(dp.endMs),
                attributes: kvs(dp.attributes || {}),
                count: String(dp.count),
                sum: dp.sum,
                bucketCounts: dp.bucketCounts.map(String),
                explicitBounds: dp.bounds,
                min: dp.min,
                max: dp.max,
            })),
        },
    }
}

// ────────────────────────────────────────────────────────────────────────────
// GenAI attribute builders — CURRENT SPEC
// (https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build attributes for a `chat` span using current spec names.
 *
 * opts: {
 *   provider, model, inputTokens, outputTokens, responseModel?,
 *   finishReasons?, responseId?, requestParams?: {temperature, top_p, ...},
 *   inputMessages?, outputMessages?, systemInstructions?,
 *   cacheCreationInputTokens?, cacheReadInputTokens?, reasoningOutputTokens?,
 *   stream?, timeToFirstChunk?, serverAddress?, conversationId?
 * }
 */
function genAiChatAttributes(opts) {
    const a = {
        'gen_ai.operation.name': 'chat',
        'gen_ai.provider.name': opts.provider,
        'gen_ai.request.model': opts.model,
        'gen_ai.response.model': opts.responseModel ?? opts.model,
        'gen_ai.usage.input_tokens': opts.inputTokens,
        'gen_ai.usage.output_tokens': opts.outputTokens,
    }
    if (opts.responseId !== undefined) a['gen_ai.response.id'] = opts.responseId
    if (opts.finishReasons !== undefined) a['gen_ai.response.finish_reasons'] = opts.finishReasons
    if (opts.stream !== undefined) a['gen_ai.request.stream'] = opts.stream
    if (opts.timeToFirstChunk !== undefined) {
        a['gen_ai.response.time_to_first_chunk'] = opts.timeToFirstChunk
    }
    if (opts.serverAddress !== undefined) a['server.address'] = opts.serverAddress
    if (opts.conversationId !== undefined) a['gen_ai.conversation.id'] = opts.conversationId
    if (opts.inputMessages !== undefined) a['gen_ai.input.messages'] = opts.inputMessages
    if (opts.outputMessages !== undefined) a['gen_ai.output.messages'] = opts.outputMessages
    if (opts.systemInstructions !== undefined) {
        a['gen_ai.system_instructions'] = opts.systemInstructions
    }
    if (opts.cacheCreationInputTokens !== undefined) {
        a['gen_ai.usage.cache_creation.input_tokens'] = opts.cacheCreationInputTokens
    }
    if (opts.cacheReadInputTokens !== undefined) {
        a['gen_ai.usage.cache_read.input_tokens'] = opts.cacheReadInputTokens
    }
    if (opts.reasoningOutputTokens !== undefined) {
        a['gen_ai.usage.reasoning.output_tokens'] = opts.reasoningOutputTokens
    }
    if (opts.requestParams) {
        for (const [k, v] of Object.entries(opts.requestParams)) {
            a[`gen_ai.request.${k}`] = v
        }
    }
    return a
}

/**
 * Build attributes for an `embeddings` span.
 */
function genAiEmbeddingsAttributes(opts) {
    const a = {
        'gen_ai.operation.name': 'embeddings',
        'gen_ai.provider.name': opts.provider,
        'gen_ai.request.model': opts.model,
        'gen_ai.usage.input_tokens': opts.inputTokens,
        'gen_ai.embeddings.dimension.count': opts.dimensions,
    }
    if (opts.encodingFormats !== undefined) {
        a['gen_ai.request.encoding_formats'] = opts.encodingFormats
    }
    return a
}

/**
 * Build attributes for an `execute_tool` span.
 */
function genAiToolAttributes(opts) {
    const a = {
        'gen_ai.operation.name': 'execute_tool',
        'gen_ai.tool.name': opts.name,
        'gen_ai.tool.type': opts.type ?? 'function',
    }
    if (opts.description !== undefined) a['gen_ai.tool.description'] = opts.description
    if (opts.callId !== undefined) a['gen_ai.tool.call.id'] = opts.callId
    if (opts.callArguments !== undefined) a['gen_ai.tool.call.arguments'] = opts.callArguments
    if (opts.callResult !== undefined) a['gen_ai.tool.call.result'] = opts.callResult
    return a
}

/**
 * Build attributes for an `invoke_agent` span.
 */
function genAiAgentAttributes(opts) {
    const a = {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.id': opts.id,
        'gen_ai.agent.name': opts.name,
    }
    if (opts.description !== undefined) a['gen_ai.agent.description'] = opts.description
    if (opts.version !== undefined) a['gen_ai.agent.version'] = opts.version
    if (opts.conversationId !== undefined) a['gen_ai.conversation.id'] = opts.conversationId
    if (opts.toolDefinitions !== undefined) a['gen_ai.tool.definitions'] = opts.toolDefinitions
    return a
}

/**
 * Build attributes for an `invoke_workflow` span.
 */
function genAiWorkflowAttributes(opts) {
    const a = {
        'gen_ai.operation.name': 'invoke_workflow',
        'gen_ai.workflow.name': opts.name,
    }
    if (opts.conversationId !== undefined) a['gen_ai.conversation.id'] = opts.conversationId
    if (opts.sessionId !== undefined) a['session.id'] = opts.sessionId
    return a
}

/**
 * Build attributes for a `retrieval` span.
 */
function genAiRetrievalAttributes(opts) {
    const a = {
        'gen_ai.operation.name': 'retrieval',
        'gen_ai.data_source.id': opts.dataSourceId,
    }
    if (opts.topK !== undefined) a['gen_ai.request.top_k'] = opts.topK
    if (opts.queryText !== undefined) a['gen_ai.retrieval.query.text'] = opts.queryText
    if (opts.documents !== undefined) a['gen_ai.retrieval.documents'] = opts.documents
    if (opts.dbSystem !== undefined) a['db.system'] = opts.dbSystem
    return a
}

// ────────────────────────────────────────────────────────────────────────────
// GenAI attribute builders — LEGACY (deprecated v1.36.0 names)
// Kept for testing the dual-read path; real instrumentations that pre-date
// the rename emit these.
// ────────────────────────────────────────────────────────────────────────────

function genAiChatAttributesLegacy(opts) {
    const a = {
        'gen_ai.system': opts.provider,
        'gen_ai.request.model': opts.model,
        'gen_ai.response.model': opts.responseModel ?? opts.model,
        'gen_ai.usage.prompt_tokens': opts.inputTokens,
        'gen_ai.usage.completion_tokens': opts.outputTokens,
        'gen_ai.usage.total_tokens': opts.inputTokens + opts.outputTokens,
        'llm.request.type': 'chat',
    }
    if (opts.prompt !== undefined) a['gen_ai.prompt'] = JSON.stringify(opts.prompt)
    if (opts.completion !== undefined) a['gen_ai.completion'] = JSON.stringify(opts.completion)
    return a
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP send helper
// ────────────────────────────────────────────────────────────────────────────

function postOtlp(baseUrl, path, payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl)
        const body = JSON.stringify(payload)
        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port || 80,
                path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = ''
                res.on('data', (c) => (data += c))
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`))
                    } else {
                        try {
                            resolve({ status: res.statusCode, body: JSON.parse(data || '{}') })
                        } catch {
                            resolve({ status: res.statusCode, body: data })
                        }
                    }
                })
            },
        )
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

module.exports = {
    // IDs + time
    generateHexId,
    traceId,
    spanId,
    msToNano,
    SpanKind,

    // OTLP encoding
    anyValue,
    kvs,

    // Builders
    buildSpan,
    buildTracesPayload,
    buildLogsPayload,
    buildMetricsPayload,
    buildHistogramMetric,

    // GenAI attribute builders — current spec
    genAiChatAttributes,
    genAiEmbeddingsAttributes,
    genAiToolAttributes,
    genAiAgentAttributes,
    genAiWorkflowAttributes,
    genAiRetrievalAttributes,

    // GenAI attribute builders — legacy
    genAiChatAttributesLegacy,

    // HTTP
    postOtlp,
}
