// The subset of the OTLP/JSON data model that ingestion reads.
export type AnyValue = {
    stringValue?: string
    intValue?: string | number
    doubleValue?: number
    boolValue?: boolean
    bytesValue?: string
    arrayValue?: { values?: AnyValue[] }
    kvlistValue?: { values?: KeyValue[] }
}

export type KeyValue = { key: string; value?: AnyValue }

export type Attributes = Record<string, unknown>

export type Scope = { name?: string; version?: string; attributes?: KeyValue[] }

export type Resource = { attributes?: KeyValue[] }

export type SpanEvent = { name?: string; attributes?: KeyValue[] }

export type Span = {
    traceId?: string
    spanId?: string
    parentSpanId?: string
    name?: string
    kind?: number
    startTimeUnixNano?: string | number
    endTimeUnixNano?: string | number
    attributes?: KeyValue[]
    events?: SpanEvent[]
    status?: { code?: number; message?: string }
}

export type LogRecord = {
    timeUnixNano?: string | number
    observedTimeUnixNano?: string | number
    severityNumber?: number
    severityText?: string
    body?: AnyValue
    attributes?: KeyValue[]
    traceId?: string
    spanId?: string
}

export type NumberDataPoint = {
    attributes?: KeyValue[]
    startTimeUnixNano?: string | number
    timeUnixNano?: string | number
    asInt?: string | number
    asDouble?: number
    value?: unknown
}

export type HistogramDataPoint = {
    attributes?: KeyValue[]
    timeUnixNano?: string | number
    count?: string | number
    sum?: number
    min?: number
    max?: number
    bucketCounts?: (string | number)[]
    explicitBounds?: number[]
}

export type Metric = {
    name: string
    description?: string
    unit?: string
    sum?: { dataPoints?: NumberDataPoint[]; aggregationTemporality?: number; isMonotonic?: boolean }
    gauge?: { dataPoints?: NumberDataPoint[] }
    histogram?: { dataPoints?: HistogramDataPoint[] }
}

export type TracesRequest = {
    resourceSpans?: { resource?: Resource; scopeSpans?: { scope?: Scope; spans?: Span[] }[] }[]
}

export type LogsRequest = {
    resourceLogs?: {
        resource?: Resource
        scopeLogs?: { scope?: Scope; logRecords?: LogRecord[] }[]
    }[]
}

export type MetricsRequest = {
    resourceMetrics?: {
        resource?: Resource
        scopeMetrics?: { scope?: Scope; metrics?: Metric[] }[]
    }[]
}

export type IngestResult = { accepted: number; rejected: number; errors: string[] }
