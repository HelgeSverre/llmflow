// OTLP/HTTP metrics ingestion: sum, gauge and histogram data points become one row each.
import * as db from '@llmflow/db'
import { extractAttributes, serviceName } from './attributes'
import { nanoToMs } from './timestamps'
import type {
    Attributes,
    HistogramDataPoint,
    IngestResult,
    Metric,
    MetricsRequest,
    NumberDataPoint,
    Scope,
} from './types'

type MetricRow = Parameters<typeof db.insertMetric>[0]

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
        )
    return value
}

function nanoString(value: string | number | undefined) {
    return nanoToMs(value) === null ? null : BigInt(value!).toString()
}

function numberValue(dp: NumberDataPoint) {
    if (dp.asInt !== undefined)
        return { value_int: parseInt(String(dp.asInt), 10), value_double: null }
    if (dp.asDouble !== undefined) return { value_int: null, value_double: dp.asDouble }
    if (typeof dp.value === 'number') {
        return Number.isInteger(dp.value)
            ? { value_int: dp.value, value_double: null }
            : { value_int: null, value_double: dp.value }
    }
    return { value_int: null, value_double: null }
}

function metricRow(
    metric: Metric,
    type: 'sum' | 'gauge' | 'histogram',
    dp: { attributes?: NumberDataPoint['attributes']; timeUnixNano?: string | number },
    attrs: Attributes,
    resourceAttrs: Attributes,
    scope: Scope,
    fields: Partial<MetricRow>,
): MetricRow {
    return {
        id: crypto.randomUUID(),
        timestamp: nanoToMs(dp.timeUnixNano) ?? Date.now(),
        name: metric.name,
        description: metric.description || null,
        unit: metric.unit || null,
        metric_type: type,
        histogram_data: null,
        service_name: serviceName(resourceAttrs),
        scope_name: scope.name || null,
        attributes: attrs,
        resource_attributes: resourceAttrs,
        ...fields,
    }
}

function sumRows(metric: Metric, resourceAttrs: Attributes, scope: Scope): MetricRow[] {
    const sum = metric.sum!
    return (sum.dataPoints || []).map((dp) => {
        const attrs = extractAttributes(dp.attributes)
        return metricRow(metric, 'sum', dp, attrs, resourceAttrs, scope, {
            aggregation_temporality: sum.aggregationTemporality ?? 0,
            is_monotonic: sum.isMonotonic ?? false,
            start_time_unix_nano: nanoString(dp.startTimeUnixNano),
            time_unix_nano: nanoString(dp.timeUnixNano),
            series_key: JSON.stringify(
                canonical({
                    name: metric.name,
                    unit: metric.unit || '',
                    resource: resourceAttrs,
                    scope: {
                        name: scope.name || '',
                        version: scope.version || '',
                        attributes: extractAttributes(scope.attributes),
                    },
                    attributes: attrs,
                }),
            ),
            ...numberValue(dp),
        })
    })
}

function gaugeRows(metric: Metric, resourceAttrs: Attributes, scope: Scope): MetricRow[] {
    return (metric.gauge!.dataPoints || []).map((dp) =>
        metricRow(
            metric,
            'gauge',
            dp,
            extractAttributes(dp.attributes),
            resourceAttrs,
            scope,
            numberValue(dp),
        ),
    )
}

function histogramRows(metric: Metric, resourceAttrs: Attributes, scope: Scope): MetricRow[] {
    return (metric.histogram!.dataPoints || []).map((dp: HistogramDataPoint) => {
        const histogram = {
            count: parseInt(String(dp.count || 0), 10),
            sum: dp.sum || 0,
            min: dp.min,
            max: dp.max,
            bucketCounts: dp.bucketCounts?.map((c) => parseInt(String(c), 10)) || [],
            explicitBounds: dp.explicitBounds || [],
        }
        return metricRow(
            metric,
            'histogram',
            dp,
            extractAttributes(dp.attributes),
            resourceAttrs,
            scope,
            {
                value_int: histogram.count,
                value_double: histogram.sum,
                histogram_data: histogram,
            },
        )
    })
}

// Summary and other metric types are not stored.
function metricRows(metric: Metric, resourceAttrs: Attributes, scope: Scope): MetricRow[] {
    if (metric.sum) return sumRows(metric, resourceAttrs, scope)
    if (metric.gauge) return gaugeRows(metric, resourceAttrs, scope)
    if (metric.histogram) return histogramRows(metric, resourceAttrs, scope)
    return []
}

export function processOtlpMetrics(body: MetricsRequest): IngestResult {
    const results: IngestResult = { accepted: 0, rejected: 0, errors: [] }
    for (const resourceMetric of body?.resourceMetrics || []) {
        const resourceAttrs = extractAttributes(resourceMetric.resource?.attributes)
        for (const scopeMetric of resourceMetric.scopeMetrics || []) {
            const scope = scopeMetric.scope || {}
            for (const metric of scopeMetric.metrics || []) {
                try {
                    for (const row of metricRows(metric, resourceAttrs, scope)) {
                        db.insertMetric(row)
                        results.accepted++
                    }
                } catch (error) {
                    results.rejected++
                    results.errors.push((error as Error).message)
                }
            }
        }
    }
    return results
}
