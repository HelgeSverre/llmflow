/**
 * OTLP Metrics Endpoint for LLMFlow
 *
 * Accepts OTLP/HTTP JSON metrics and stores them for AI CLI tool observability.
 * Supports metrics from Claude Code, Gemini CLI, etc.
 *
 * Supports:
 * - OTLP/HTTP JSON format (Content-Type: application/json)
 * - Sum (Counter), Gauge, Histogram metric types
 * - Token usage and cost metrics extraction
 */

const db = require('@llmflow/db')

/**
 * Extract attributes from OTLP KeyValue array format
 */
const { extractAttributes } = require('./attributes')

/**
 * Convert nanoseconds timestamp to milliseconds
 */
const { nanoToMs } = require('./timestamps')

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonical(value[key])]),
        )
    return value
}

function nanoString(value) {
    return nanoToMs(value) === null ? null : BigInt(value).toString()
}

/**
 * Extract value from data point
 * Handles asInt, asDouble, and various OTLP value formats
 */
function extractValue(dataPoint) {
    if (dataPoint.asInt !== undefined) {
        return { value_int: parseInt(dataPoint.asInt, 10), value_double: null }
    }
    if (dataPoint.asDouble !== undefined) {
        return { value_int: null, value_double: dataPoint.asDouble }
    }
    if (dataPoint.value !== undefined) {
        if (typeof dataPoint.value === 'number') {
            if (Number.isInteger(dataPoint.value)) {
                return { value_int: dataPoint.value, value_double: null }
            }
            return { value_int: null, value_double: dataPoint.value }
        }
    }
    return { value_int: null, value_double: null }
}

/**
 * Process Sum metric (Counter)
 * Sum metrics have dataPoints with aggregationTemporality
 */
function processSum(metric, resourceAttrs, scopeInfo) {
    const results = []
    const sum = metric.sum
    if (!sum || !sum.dataPoints) return results

    for (const dp of sum.dataPoints) {
        const attrs = extractAttributes(dp.attributes)
        const { value_int, value_double } = extractValue(dp)

        results.push({
            id: crypto.randomUUID(),
            timestamp: nanoToMs(dp.timeUnixNano) ?? Date.now(),
            name: metric.name,
            description: metric.description || null,
            unit: metric.unit || null,
            metric_type: 'sum',
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
                        name: scopeInfo.name || '',
                        version: scopeInfo.version || '',
                        attributes: extractAttributes(scopeInfo.attributes),
                    },
                    attributes: attrs,
                }),
            ),
            value_int,
            value_double,
            histogram_data: null,
            service_name: resourceAttrs['service.name'] || 'unknown',
            scope_name: scopeInfo.name || null,
            attributes: attrs,
            resource_attributes: resourceAttrs,
        })
    }

    return results
}

/**
 * Process Gauge metric
 * Gauge metrics represent point-in-time values
 */
function processGauge(metric, resourceAttrs, scopeInfo) {
    const results = []
    const gauge = metric.gauge
    if (!gauge || !gauge.dataPoints) return results

    for (const dp of gauge.dataPoints) {
        const attrs = extractAttributes(dp.attributes)
        const { value_int, value_double } = extractValue(dp)

        results.push({
            id: crypto.randomUUID(),
            timestamp: nanoToMs(dp.timeUnixNano) ?? Date.now(),
            name: metric.name,
            description: metric.description || null,
            unit: metric.unit || null,
            metric_type: 'gauge',
            value_int,
            value_double,
            histogram_data: null,
            service_name: resourceAttrs['service.name'] || 'unknown',
            scope_name: scopeInfo.name || null,
            attributes: attrs,
            resource_attributes: resourceAttrs,
        })
    }

    return results
}

/**
 * Process Histogram metric
 * Histogram metrics have buckets and bounds
 */
function processHistogram(metric, resourceAttrs, scopeInfo) {
    const results = []
    const histogram = metric.histogram
    if (!histogram || !histogram.dataPoints) return results

    for (const dp of histogram.dataPoints) {
        const attrs = extractAttributes(dp.attributes)

        const histogramData = {
            count: parseInt(dp.count || 0, 10),
            sum: dp.sum || 0,
            min: dp.min,
            max: dp.max,
            bucketCounts: dp.bucketCounts?.map((c) => parseInt(c, 10)) || [],
            explicitBounds: dp.explicitBounds || [],
        }

        results.push({
            id: crypto.randomUUID(),
            timestamp: nanoToMs(dp.timeUnixNano) ?? Date.now(),
            name: metric.name,
            description: metric.description || null,
            unit: metric.unit || null,
            metric_type: 'histogram',
            value_int: histogramData.count,
            value_double: histogramData.sum,
            histogram_data: histogramData,
            service_name: resourceAttrs['service.name'] || 'unknown',
            scope_name: scopeInfo.name || null,
            attributes: attrs,
            resource_attributes: resourceAttrs,
        })
    }

    return results
}

/**
 * Process a single metric based on its type
 */
function processMetric(metric, resourceAttrs, scopeInfo) {
    if (metric.sum) {
        return processSum(metric, resourceAttrs, scopeInfo)
    }
    if (metric.gauge) {
        return processGauge(metric, resourceAttrs, scopeInfo)
    }
    if (metric.histogram) {
        return processHistogram(metric, resourceAttrs, scopeInfo)
    }
    // Summary and other types - store as gauge with raw data
    return []
}

/**
 * Process OTLP/HTTP JSON metrics request
 *
 * Expected format (OTLP/HTTP JSON):
 * {
 *   "resourceMetrics": [
 *     {
 *       "resource": { "attributes": [...] },
 *       "scopeMetrics": [
 *         {
 *           "scope": { "name": "...", "version": "..." },
 *           "metrics": [
 *             {
 *               "name": "metric.name",
 *               "description": "...",
 *               "unit": "...",
 *               "sum": { "dataPoints": [...] }
 *               // or "gauge": { "dataPoints": [...] }
 *               // or "histogram": { "dataPoints": [...] }
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
function processOtlpMetrics(body) {
    const results = {
        accepted: 0,
        rejected: 0,
        errors: [],
    }

    if (!body || !body.resourceMetrics) {
        return results
    }

    for (const resourceMetric of body.resourceMetrics) {
        const resourceAttrs = extractAttributes(resourceMetric.resource?.attributes)

        for (const scopeMetric of resourceMetric.scopeMetrics || []) {
            const scopeInfo = scopeMetric.scope || {}

            for (const metric of scopeMetric.metrics || []) {
                try {
                    const dataPoints = processMetric(metric, resourceAttrs, scopeInfo)

                    for (const dp of dataPoints) {
                        db.insertMetric(dp)
                        results.accepted++
                    }
                } catch (err) {
                    results.rejected++
                    results.errors.push(err.message)
                }
            }
        }
    }

    return results
}

module.exports = {
    processOtlpMetrics,
    extractAttributes,
    extractValue,
    processSum,
    processGauge,
    processHistogram,
    nanoToMs,
}
