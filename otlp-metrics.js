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

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

/**
 * Extract attributes from OTLP KeyValue array format
 */
function extractAttributes(attrs) {
    if (!attrs || !Array.isArray(attrs)) return {};
    
    const result = {};
    for (const attr of attrs) {
        const key = attr.key;
        const val = attr.value;
        if (!val) continue;
        
        if (val.stringValue !== undefined) result[key] = val.stringValue;
        else if (val.intValue !== undefined) result[key] = parseInt(val.intValue, 10);
        else if (val.doubleValue !== undefined) result[key] = val.doubleValue;
        else if (val.boolValue !== undefined) result[key] = val.boolValue;
        else if (val.arrayValue?.values) {
            result[key] = val.arrayValue.values.map(v => 
                v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? null
            );
        }
    }
    return result;
}

/**
 * Convert nanoseconds timestamp to milliseconds
 */
function nanoToMs(nanoStr) {
    if (!nanoStr) return Date.now();
    const nano = BigInt(nanoStr);
    return Number(nano / BigInt(1000000));
}

/**
 * Extract value from data point
 * Handles asInt, asDouble, and various OTLP value formats
 */
function extractValue(dataPoint) {
    if (dataPoint.asInt !== undefined) {
        return { value_int: parseInt(dataPoint.asInt, 10), value_double: null };
    }
    if (dataPoint.asDouble !== undefined) {
        return { value_int: null, value_double: dataPoint.asDouble };
    }
    if (dataPoint.value !== undefined) {
        if (typeof dataPoint.value === 'number') {
            if (Number.isInteger(dataPoint.value)) {
                return { value_int: dataPoint.value, value_double: null };
            }
            return { value_int: null, value_double: dataPoint.value };
        }
    }
    return { value_int: null, value_double: null };
}

/**
 * Process Sum metric (Counter)
 * Sum metrics have dataPoints with aggregationTemporality
 */
function processSum(metric, resourceAttrs, scopeInfo) {
    const results = [];
    const sum = metric.sum;
    if (!sum || !sum.dataPoints) return results;

    for (const dp of sum.dataPoints) {
        const attrs = extractAttributes(dp.attributes);
        const { value_int, value_double } = extractValue(dp);
        
        results.push({
            id: uuidv4(),
            timestamp: nanoToMs(dp.timeUnixNano),
            name: metric.name,
            description: metric.description || null,
            unit: metric.unit || null,
            metric_type: 'sum',
            value_int,
            value_double,
            histogram_data: null,
            service_name: resourceAttrs['service.name'] || 'unknown',
            scope_name: scopeInfo.name || null,
            attributes: attrs,
            resource_attributes: resourceAttrs
        });
    }
    
    return results;
}

/**
 * Process Gauge metric
 * Gauge metrics represent point-in-time values
 */
function processGauge(metric, resourceAttrs, scopeInfo) {
    const results = [];
    const gauge = metric.gauge;
    if (!gauge || !gauge.dataPoints) return results;

    for (const dp of gauge.dataPoints) {
        const attrs = extractAttributes(dp.attributes);
        const { value_int, value_double } = extractValue(dp);
        
        results.push({
            id: uuidv4(),
            timestamp: nanoToMs(dp.timeUnixNano),
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
            resource_attributes: resourceAttrs
        });
    }
    
    return results;
}

/**
 * Process Histogram metric
 * Histogram metrics have buckets and bounds
 */
function processHistogram(metric, resourceAttrs, scopeInfo) {
    const results = [];
    const histogram = metric.histogram;
    if (!histogram || !histogram.dataPoints) return results;

    for (const dp of histogram.dataPoints) {
        const attrs = extractAttributes(dp.attributes);
        
        const histogramData = {
            count: parseInt(dp.count || 0, 10),
            sum: dp.sum || 0,
            min: dp.min,
            max: dp.max,
            bucketCounts: dp.bucketCounts?.map(c => parseInt(c, 10)) || [],
            explicitBounds: dp.explicitBounds || []
        };
        
        results.push({
            id: uuidv4(),
            timestamp: nanoToMs(dp.timeUnixNano),
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
            resource_attributes: resourceAttrs
        });
    }
    
    return results;
}

/**
 * Process a single metric based on its type
 */
function processMetric(metric, resourceAttrs, scopeInfo) {
    if (metric.sum) {
        return processSum(metric, resourceAttrs, scopeInfo);
    }
    if (metric.gauge) {
        return processGauge(metric, resourceAttrs, scopeInfo);
    }
    if (metric.histogram) {
        return processHistogram(metric, resourceAttrs, scopeInfo);
    }
    // Summary and other types - store as gauge with raw data
    return [];
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
        errors: []
    };
    
    if (!body || !body.resourceMetrics) {
        return results;
    }
    
    for (const resourceMetric of body.resourceMetrics) {
        const resourceAttrs = extractAttributes(resourceMetric.resource?.attributes);
        
        for (const scopeMetric of (resourceMetric.scopeMetrics || [])) {
            const scopeInfo = scopeMetric.scope || {};
            
            for (const metric of (scopeMetric.metrics || [])) {
                try {
                    const dataPoints = processMetric(metric, resourceAttrs, scopeInfo);
                    
                    for (const dp of dataPoints) {
                        db.insertMetric(dp);
                        results.accepted++;
                    }
                } catch (err) {
                    results.rejected++;
                    results.errors.push(err.message);
                }
            }
        }
    }
    
    return results;
}

/**
 * Express middleware for OTLP metrics endpoint
 */
function createMetricsHandler() {
    return (req, res) => {
        const contentType = req.headers['content-type'] || '';
        
        if (!contentType.includes('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Only application/json is supported. Use OTLP/HTTP JSON format.'
            });
        }
        
        try {
            const results = processOtlpMetrics(req.body);
            
            res.status(200).json({
                partialSuccess: results.rejected > 0 ? {
                    rejectedDataPoints: results.rejected,
                    errorMessage: results.errors.slice(0, 5).join('; ')
                } : undefined
            });
        } catch (err) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message
            });
        }
    };
}

module.exports = {
    processOtlpMetrics,
    createMetricsHandler,
    extractAttributes,
    extractValue,
    processSum,
    processGauge,
    processHistogram,
    nanoToMs
};
