// Forwards stored traces, logs and metrics to another OTLP/HTTP backend
// (Jaeger, Phoenix/Arize, Langfuse, Opik, Grafana Tempo, ...), batched per signal.
import type * as Db from '@llmflow/db'
import { config } from '@llmflow/shared/config'
import { log } from '@llmflow/shared/logger'
import { fixedWidthId } from './ids'
import { messageType, type Signal } from './transport'
import type { AnyValue, KeyValue } from './types'

type Kind = 'traces' | 'logs' | 'metrics'
type Protocol = 'http/json' | 'http/protobuf'

// OTLP_EXPORT_ENDPOINT is an alias for the traces endpoint only; logs and metrics
// are exported only when their own endpoint is set.
const EXPORT = config.otlpExport
const ENDPOINTS: Record<Kind, string | undefined> = EXPORT.endpoints
const SIGNALS: Record<Kind, Signal> = { traces: 'trace', logs: 'logs', metrics: 'metrics' }
const HEADERS = parseHeaders(EXPORT.headers)
const ENABLED = EXPORT.enabled
const PROTOCOL = parseProtocol(EXPORT.protocol)
const BATCH_SIZE = EXPORT.batchSize
const FLUSH_INTERVAL_MS = EXPORT.flushIntervalMs
const TIMEOUT_MS = 10_000

// Also emit the deprecated v1.36.0 GenAI names for collectors built against the old spec.
const EMIT_LEGACY_GENAI_ATTRS = EXPORT.legacyAttributes

// Inverse of GENAI_OPERATION_TO_SPAN_TYPE in traces.ts (lossy: several operations map to 'llm').
const SPAN_TYPE_TO_GENAI_OPERATION: Record<string, string> = {
    llm: 'chat',
    embedding: 'embeddings',
    tool: 'execute_tool',
    agent: 'invoke_agent',
    chain: 'invoke_workflow',
    retrieval: 'retrieval',
}

// Bookkeeping keys ingestion adds to a span's attributes; not part of the original span.
const INTERNAL_ATTRIBUTES = new Set(['_spanName', 'otel_span_kind'])
const SPAN_KIND_CLIENT = 3

function parseHeaders(value: string) {
    const headers: Record<string, string> = {}
    for (const pair of value.split(',')) {
        const [key, ...rest] = pair.split('=')
        if (key?.trim() && rest.length) headers[key.trim()] = rest.join('=').trim()
    }
    return headers
}

function parseProtocol(value: string | undefined): Protocol {
    if (!value || value === 'http/json') return 'http/json'
    if (value === 'http/protobuf') return 'http/protobuf'
    log.warn(`Unknown OTLP_EXPORT_PROTOCOL "${value}"; using http/json`)
    return 'http/json'
}

function anyValue(value: unknown): AnyValue {
    if (typeof value === 'string') return { stringValue: value }
    if (typeof value === 'boolean') return { boolValue: value }
    if (typeof value === 'number')
        return Number.isSafeInteger(value) ? { intValue: String(value) } : { doubleValue: value }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(anyValue) } }
    if (value && typeof value === 'object')
        return { kvlistValue: { values: keyValues(value as Record<string, unknown>) } }
    return { stringValue: String(value ?? '') }
}

function keyValues(values: Record<string, unknown> | null | undefined): KeyValue[] {
    return Object.entries(values || {}).map(([key, value]) => ({ key, value: anyValue(value) }))
}

const nanos = (ms: number) => (BigInt(Math.round(ms)) * 1_000_000n).toString()

export function traceToOtlpSpan(trace: Db.Span) {
    const start = BigInt(trace.timestamp) * 1_000_000n
    const end = start + BigInt(Math.round((trace.duration_ms || 0) * 1_000_000))
    const spanType = trace.span_type || 'llm'
    const attributes: KeyValue[] = [
        {
            key: 'gen_ai.operation.name',
            value: { stringValue: SPAN_TYPE_TO_GENAI_OPERATION[spanType] || 'chat' },
        },
        { key: 'gen_ai.provider.name', value: { stringValue: trace.provider || 'unknown' } },
        { key: 'gen_ai.request.model', value: { stringValue: trace.model || 'unknown' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: String(trace.prompt_tokens || 0) } },
        {
            key: 'gen_ai.usage.output_tokens',
            value: { intValue: String(trace.completion_tokens || 0) },
        },
        { key: 'gen_ai.usage.total_tokens', value: { intValue: String(trace.total_tokens || 0) } },
        { key: 'llmflow.cost', value: { doubleValue: trace.estimated_cost || 0 } },
        { key: 'llmflow.span_type', value: { stringValue: spanType } },
    ]
    if (EMIT_LEGACY_GENAI_ATTRS)
        attributes.push(
            { key: 'gen_ai.system', value: { stringValue: trace.provider || 'unknown' } },
            {
                key: 'gen_ai.usage.prompt_tokens',
                value: { intValue: String(trace.prompt_tokens || 0) },
            },
            {
                key: 'gen_ai.usage.completion_tokens',
                value: { intValue: String(trace.completion_tokens || 0) },
            },
        )
    const columns: [string, unknown][] = [
        ['llmflow.span_name', trace.span_name],
        ['service.name', trace.service_name],
        ['session.id', trace.session_id],
        ['gen_ai.conversation.id', trace.conversation_id],
        ['gen_ai.agent.name', trace.agent_name],
    ]
    for (const [key, value] of columns) if (value) attributes.push({ key, value: anyValue(value) })

    // The span's own attributes follow; the columns above win on conflicts.
    const emitted = new Set(attributes.map(({ key }) => key))
    for (const [key, value] of Object.entries(trace.attributes || {}))
        if (value != null && !emitted.has(key) && !INTERNAL_ATTRIBUTES.has(key))
            attributes.push({ key, value: anyValue(value) })

    const kind = trace.attributes?.otel_span_kind
    return {
        traceId: fixedWidthId(trace.trace_id || trace.id, 32),
        spanId: fixedWidthId(trace.id, 16),
        parentSpanId: trace.parent_id ? fixedWidthId(trace.parent_id, 16) : undefined,
        name: trace.span_name || trace.model || 'llm.request',
        kind: typeof kind === 'number' ? kind : SPAN_KIND_CLIENT,
        startTimeUnixNano: start.toString(),
        endTimeUnixNano: end.toString(),
        attributes,
        status: {
            code: trace.status && trace.status >= 400 ? 2 : 1,
            message: trace.error || undefined,
        },
    }
}

export function logToOtlpRecord(entry: Db.Log) {
    const time = nanos(entry.timestamp)
    const attributes: KeyValue[] = entry.event_name
        ? [{ key: 'event.name', value: { stringValue: entry.event_name } }]
        : []
    attributes.push(...keyValues(entry.attributes))
    return {
        timeUnixNano: time,
        observedTimeUnixNano: entry.observed_timestamp ? nanos(entry.observed_timestamp) : time,
        severityNumber: entry.severity_number ?? 0,
        severityText: entry.severity_text || 'INFO',
        body: entry.body == null ? undefined : anyValue(entry.body),
        attributes,
        traceId: entry.trace_id ? fixedWidthId(entry.trace_id, 32) : undefined,
        spanId: entry.span_id ? fixedWidthId(entry.span_id, 16) : undefined,
    }
}

type Histogram = {
    count?: number
    sum?: number
    min?: number
    max?: number
    bucketCounts?: number[]
    explicitBounds?: number[]
}

type DataPoint = Record<string, unknown>

export type OtlpMetric = {
    name: string
    description: string
    unit: string
    sum?: { dataPoints: DataPoint[]; aggregationTemporality: number; isMonotonic: boolean }
    gauge?: { dataPoints: DataPoint[] }
    histogram?: { dataPoints: DataPoint[]; aggregationTemporality: number }
}

export function metricToOtlpMetric(metric: Db.Metric): OtlpMetric {
    const point: DataPoint = {
        attributes: keyValues(metric.attributes),
        timeUnixNano: metric.time_unix_nano || nanos(metric.timestamp),
        ...(metric.start_time_unix_nano ? { startTimeUnixNano: metric.start_time_unix_nano } : {}),
    }
    if (metric.value_int != null) point.asInt = String(metric.value_int)
    else if (metric.value_double != null) point.asDouble = metric.value_double
    const base = {
        name: metric.name,
        description: metric.description || '',
        unit: metric.unit || '',
    }

    if (metric.metric_type === 'sum')
        return {
            ...base,
            sum: {
                dataPoints: [point],
                aggregationTemporality: metric.aggregation_temporality ?? 2,
                isMonotonic: metric.is_monotonic == null ? true : !!metric.is_monotonic,
            },
        }
    if (metric.metric_type === 'histogram') {
        const histogram = (metric.histogram_data || {}) as Histogram
        return {
            ...base,
            histogram: {
                dataPoints: [
                    {
                        ...point,
                        count: histogram.count || 0,
                        sum: histogram.sum || 0,
                        bucketCounts: histogram.bucketCounts || [],
                        explicitBounds: histogram.explicitBounds || [],
                        min: histogram.min,
                        max: histogram.max,
                    },
                ],
                aggregationTemporality: 2,
            },
        }
    }
    return { ...base, gauge: { dataPoints: [point] } }
}

type Stored = {
    service_name?: string | null
    scope_name?: string | null
    resource_attributes?: Record<string, unknown> | null
}

type ResourceGroup<T> = {
    resource: { attributes: KeyValue[] }
    scope: { name: string }
    items: T[]
}

// OTLP groups records by resource and scope; LLMFlow stores both per record.
function groupByResource<R extends Stored, T>(
    records: R[],
    convert: (record: R) => T,
    serviceName: string,
): ResourceGroup<T>[] {
    const groups = new Map<string, ResourceGroup<T>>()
    for (const record of records) {
        const resource = {
            ...record.resource_attributes,
            'service.name': record.service_name || serviceName,
        }
        const scope = { name: record.scope_name || 'llmflow' }
        const key = JSON.stringify([resource, scope])
        if (!groups.has(key))
            groups.set(key, { resource: { attributes: keyValues(resource) }, scope, items: [] })
        groups.get(key)!.items.push(convert(record))
    }
    return [...groups.values()]
}

export function buildTracesPayload(records: Db.Span[], serviceName = 'llmflow') {
    return {
        resourceSpans: groupByResource(records, traceToOtlpSpan, serviceName).map(
            ({ resource, scope, items }) => ({ resource, scopeSpans: [{ scope, spans: items }] }),
        ),
    }
}

export function buildLogsPayload(records: Db.Log[], serviceName = 'llmflow') {
    return {
        resourceLogs: groupByResource(records, logToOtlpRecord, serviceName).map(
            ({ resource, scope, items }) => ({
                resource,
                scopeLogs: [{ scope, logRecords: items }],
            }),
        ),
    }
}

export function buildMetricsPayload(records: Db.Metric[], serviceName = 'llmflow') {
    return {
        resourceMetrics: groupByResource(records, metricToOtlpMetric, serviceName).map(
            ({ resource, scope, items }) => ({
                resource,
                scopeMetrics: [{ scope, metrics: items }],
            }),
        ),
    }
}

// JSON carries IDs as hex strings; protobuf needs the raw bytes.
function hexIdsToBytes(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(hexIdsToBytes)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            (key === 'traceId' || key === 'spanId' || key === 'parentSpanId') &&
            typeof item === 'string'
                ? Buffer.from(item, 'hex')
                : hexIdsToBytes(item),
        ]),
    )
}

export function encodePayload(
    kind: Kind,
    payload: object,
    protocol: Protocol = PROTOCOL,
): { contentType: string; body: string | Buffer } {
    if (protocol === 'http/json')
        return { contentType: 'application/json', body: JSON.stringify(payload) }
    const type = messageType(SIGNALS[kind], 'Request')
    const message = type.fromObject(hexIdsToBytes(payload) as Record<string, unknown>)
    return {
        contentType: 'application/x-protobuf',
        body: Buffer.from(type.encode(message).finish()),
    }
}

async function send(kind: Kind, payload: object) {
    const endpoint = ENDPOINTS[kind]!
    const { contentType, body } = encodePayload(kind, payload)
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': contentType, ...HEADERS },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (response.ok) return null
        return `HTTP ${response.status}: ${await response.text()}`
    } catch (error) {
        return (error as Error).message
    }
}

const batches: { traces: Db.Span[]; logs: Db.Log[]; metrics: Db.Metric[] } = {
    traces: [],
    logs: [],
    metrics: [],
}
const pending = new Set<Promise<void>>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

async function exportBatch(kind: Kind, records: object[]) {
    const payload =
        kind === 'traces'
            ? buildTracesPayload(records as Db.Span[])
            : kind === 'logs'
              ? buildLogsPayload(records as Db.Log[])
              : buildMetricsPayload(records as Db.Metric[])
    const error = await send(kind, payload)
    if (error) log.error(`Failed to export ${kind}: ${error}`)
    else log.debug(`Exported ${records.length} ${kind} to ${ENDPOINTS[kind]}`)
}

function flush(kind: Kind) {
    const records = batches[kind]
    if (!records.length) return Promise.resolve()
    batches[kind] = []
    const promise = exportBatch(kind, records).finally(() => pending.delete(promise))
    pending.add(promise)
    return promise
}

export async function flushAll() {
    await Promise.all([flush('traces'), flush('logs'), flush('metrics'), ...pending])
}

function scheduleFlush() {
    if (flushTimer) return
    flushTimer = setTimeout(() => {
        flushTimer = null
        void flushAll()
    }, FLUSH_INTERVAL_MS)
}

function queue<K extends Kind>(kind: K, record: (typeof batches)[K][number]) {
    ;(batches[kind] as object[]).push(record)
    if (batches[kind].length >= BATCH_SIZE) void flush(kind)
    else scheduleFlush()
}

export function getConfig() {
    return {
        enabled: ENABLED,
        endpoints: ENDPOINTS,
        protocol: PROTOCOL,
        batchSize: BATCH_SIZE,
        flushIntervalMs: FLUSH_INTERVAL_MS,
        hasTraces: !!ENDPOINTS.traces,
        hasLogs: !!ENDPOINTS.logs,
        hasMetrics: !!ENDPOINTS.metrics,
    }
}

type Subscriptions = Pick<typeof Db, 'subscribeSpans' | 'subscribeLogs' | 'subscribeMetrics'>

// Subscribes the exporter to new records. The returned stop function unsubscribes and
// flushes what is queued; it is a no-op when export is disabled.
let stopHooks: (() => Promise<void>) | null = null
export function initExportHooks(db: Subscriptions): () => Promise<void> {
    if (stopHooks) return stopHooks
    if (!ENABLED) return async () => {}
    const unsubscribe: (() => void)[] = []
    if (ENDPOINTS.traces) unsubscribe.push(db.subscribeSpans((trace) => queue('traces', trace)))
    if (ENDPOINTS.logs) unsubscribe.push(db.subscribeLogs((entry) => queue('logs', entry)))
    if (ENDPOINTS.metrics)
        unsubscribe.push(db.subscribeMetrics((metric) => queue('metrics', metric)))
    process.on('beforeExit', flushAll)
    stopHooks = () => {
        unsubscribe.forEach((stop) => stop())
        process.off('beforeExit', flushAll)
        if (flushTimer) clearTimeout(flushTimer)
        flushTimer = null
        stopHooks = null
        return flushAll()
    }
    return stopHooks
}
