/**
 * OTLP Export Module for LLMFlow
 * 
 * Exports traces, logs, and metrics to external observability backends
 * via OpenTelemetry Protocol (OTLP/HTTP JSON).
 * 
 * Supported backends:
 * - Jaeger (OTLP)
 * - Phoenix/Arize (OTLP)
 * - Langfuse (OTLP)
 * - Opik/Comet (OTLP)
 * - Grafana Tempo (OTLP)
 * - Any OTLP-compatible backend
 */

const https = require('https');
const http = require('http');
const log = require('./logger');

const EXPORT_ENDPOINTS = {
    traces: process.env.OTLP_EXPORT_TRACES_ENDPOINT || process.env.OTLP_EXPORT_ENDPOINT,
    logs: process.env.OTLP_EXPORT_LOGS_ENDPOINT,
    metrics: process.env.OTLP_EXPORT_METRICS_ENDPOINT
};

const EXPORT_HEADERS = parseHeaders(process.env.OTLP_EXPORT_HEADERS || '');
const EXPORT_ENABLED = process.env.OTLP_EXPORT_ENABLED === 'true' || !!EXPORT_ENDPOINTS.traces;
const BATCH_SIZE = parseInt(process.env.OTLP_EXPORT_BATCH_SIZE || '100', 10);
const FLUSH_INTERVAL_MS = parseInt(process.env.OTLP_EXPORT_FLUSH_INTERVAL || '5000', 10);

let traceBatch = [];
let logBatch = [];
let metricBatch = [];
let flushTimer = null;

/**
 * Parse headers from comma-separated key=value format
 * Example: "Authorization=Bearer xxx,X-Custom=value"
 */
function parseHeaders(headerStr) {
    if (!headerStr) return {};
    const headers = {};
    headerStr.split(',').forEach(pair => {
        const [key, ...valueParts] = pair.split('=');
        if (key && valueParts.length > 0) {
            headers[key.trim()] = valueParts.join('=').trim();
        }
    });
    return headers;
}

/**
 * Convert LLMFlow trace to OTLP span format
 */
function traceToOtlpSpan(trace) {
    const startTimeNano = BigInt(trace.timestamp) * BigInt(1000000);
    const durationNano = BigInt(trace.duration_ms || 0) * BigInt(1000000);
    const endTimeNano = startTimeNano + durationNano;
    
    const attributes = [
        { key: 'gen_ai.system', value: { stringValue: trace.provider || 'unknown' } },
        { key: 'gen_ai.request.model', value: { stringValue: trace.model || 'unknown' } },
        { key: 'gen_ai.usage.prompt_tokens', value: { intValue: String(trace.prompt_tokens || 0) } },
        { key: 'gen_ai.usage.completion_tokens', value: { intValue: String(trace.completion_tokens || 0) } },
        { key: 'gen_ai.usage.total_tokens', value: { intValue: String(trace.total_tokens || 0) } },
        { key: 'llmflow.cost', value: { doubleValue: trace.estimated_cost || 0 } },
        { key: 'llmflow.span_type', value: { stringValue: trace.span_type || 'llm' } }
    ];
    
    if (trace.span_name) {
        attributes.push({ key: 'llmflow.span_name', value: { stringValue: trace.span_name } });
    }
    
    if (trace.service_name) {
        attributes.push({ key: 'service.name', value: { stringValue: trace.service_name } });
    }
    
    const statusCode = (trace.status && trace.status >= 400) ? 2 : 1;
    
    return {
        traceId: normalizeTraceId(trace.trace_id || trace.id),
        spanId: normalizeSpanId(trace.id),
        parentSpanId: trace.parent_id ? normalizeSpanId(trace.parent_id) : undefined,
        name: trace.span_name || trace.model || 'llm.request',
        kind: 3, // SPAN_KIND_CLIENT
        startTimeUnixNano: startTimeNano.toString(),
        endTimeUnixNano: endTimeNano.toString(),
        attributes,
        status: {
            code: statusCode,
            message: trace.error || undefined
        }
    };
}

/**
 * Normalize trace ID to 32 hex characters
 */
function normalizeTraceId(id) {
    if (!id) return '00000000000000000000000000000000';
    const clean = id.replace(/-/g, '').toLowerCase();
    if (clean.length >= 32) return clean.slice(0, 32);
    return clean.padStart(32, '0');
}

/**
 * Normalize span ID to 16 hex characters
 */
function normalizeSpanId(id) {
    if (!id) return '0000000000000000';
    const clean = id.replace(/-/g, '').toLowerCase();
    if (clean.length >= 16) return clean.slice(0, 16);
    return clean.padStart(16, '0');
}

/**
 * Convert LLMFlow log to OTLP log record format
 */
function logToOtlpRecord(logEntry) {
    const timeNano = BigInt(logEntry.timestamp) * BigInt(1000000);
    
    const attributes = [];
    if (logEntry.event_name) {
        attributes.push({ key: 'event.name', value: { stringValue: logEntry.event_name } });
    }
    
    if (logEntry.attributes && typeof logEntry.attributes === 'object') {
        Object.entries(logEntry.attributes).forEach(([key, value]) => {
            if (typeof value === 'string') {
                attributes.push({ key, value: { stringValue: value } });
            } else if (typeof value === 'number') {
                attributes.push({ key, value: { doubleValue: value } });
            } else if (typeof value === 'boolean') {
                attributes.push({ key, value: { boolValue: value } });
            }
        });
    }
    
    return {
        timeUnixNano: timeNano.toString(),
        observedTimeUnixNano: logEntry.observed_timestamp 
            ? (BigInt(logEntry.observed_timestamp) * BigInt(1000000)).toString()
            : timeNano.toString(),
        severityNumber: logEntry.severity_number || 9, // INFO
        severityText: logEntry.severity_text || 'INFO',
        body: logEntry.body ? { stringValue: logEntry.body } : undefined,
        attributes,
        traceId: logEntry.trace_id ? normalizeTraceId(logEntry.trace_id) : undefined,
        spanId: logEntry.span_id ? normalizeSpanId(logEntry.span_id) : undefined
    };
}

/**
 * Convert LLMFlow metric to OTLP metric format
 */
function metricToOtlpMetric(metric) {
    const timeNano = BigInt(metric.timestamp) * BigInt(1000000);
    
    const attributes = [];
    if (metric.attributes && typeof metric.attributes === 'object') {
        Object.entries(metric.attributes).forEach(([key, value]) => {
            if (typeof value === 'string') {
                attributes.push({ key, value: { stringValue: value } });
            } else if (typeof value === 'number') {
                attributes.push({ key, value: { doubleValue: value } });
            }
        });
    }
    
    const dataPoint = {
        attributes,
        timeUnixNano: timeNano.toString()
    };
    
    if (metric.value_int !== null && metric.value_int !== undefined) {
        dataPoint.asInt = String(metric.value_int);
    } else if (metric.value_double !== null && metric.value_double !== undefined) {
        dataPoint.asDouble = metric.value_double;
    }
    
    const metricData = {
        name: metric.name,
        description: metric.description || '',
        unit: metric.unit || ''
    };
    
    switch (metric.metric_type) {
        case 'sum':
            metricData.sum = {
                dataPoints: [dataPoint],
                aggregationTemporality: 2, // CUMULATIVE
                isMonotonic: true
            };
            break;
        case 'histogram':
            metricData.histogram = {
                dataPoints: [{
                    ...dataPoint,
                    count: metric.histogram_data?.count || 0,
                    sum: metric.histogram_data?.sum || 0,
                    bucketCounts: metric.histogram_data?.bucketCounts || [],
                    explicitBounds: metric.histogram_data?.explicitBounds || []
                }],
                aggregationTemporality: 2
            };
            break;
        case 'gauge':
        default:
            metricData.gauge = {
                dataPoints: [dataPoint]
            };
    }
    
    return metricData;
}

/**
 * Build OTLP export payload for traces
 */
function buildTracesPayload(traces, serviceName = 'llmflow') {
    const spans = traces.map(traceToOtlpSpan);
    
    return {
        resourceSpans: [{
            resource: {
                attributes: [
                    { key: 'service.name', value: { stringValue: serviceName } },
                    { key: 'service.version', value: { stringValue: process.env.npm_package_version || '0.3.0' } },
                    { key: 'telemetry.sdk.name', value: { stringValue: 'llmflow' } }
                ]
            },
            scopeSpans: [{
                scope: {
                    name: 'llmflow',
                    version: process.env.npm_package_version || '0.3.0'
                },
                spans
            }]
        }]
    };
}

/**
 * Build OTLP export payload for logs
 */
function buildLogsPayload(logs, serviceName = 'llmflow') {
    const logRecords = logs.map(logToOtlpRecord);
    
    return {
        resourceLogs: [{
            resource: {
                attributes: [
                    { key: 'service.name', value: { stringValue: serviceName } }
                ]
            },
            scopeLogs: [{
                scope: {
                    name: 'llmflow'
                },
                logRecords
            }]
        }]
    };
}

/**
 * Build OTLP export payload for metrics
 */
function buildMetricsPayload(metrics, serviceName = 'llmflow') {
    const otlpMetrics = metrics.map(metricToOtlpMetric);
    
    return {
        resourceMetrics: [{
            resource: {
                attributes: [
                    { key: 'service.name', value: { stringValue: serviceName } }
                ]
            },
            scopeMetrics: [{
                scope: {
                    name: 'llmflow'
                },
                metrics: otlpMetrics
            }]
        }]
    };
}

/**
 * Send data to OTLP endpoint
 */
async function sendToEndpoint(endpoint, payload) {
    if (!endpoint) return { success: false, error: 'No endpoint configured' };
    
    return new Promise((resolve) => {
        const url = new URL(endpoint);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...EXPORT_HEADERS
            }
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, status: res.statusCode });
                } else {
                    resolve({ success: false, status: res.statusCode, error: data });
                }
            });
        });
        
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * Export traces to external backend
 */
async function exportTraces(traces) {
    if (!EXPORT_ENDPOINTS.traces || traces.length === 0) return;
    
    const payload = buildTracesPayload(traces);
    const result = await sendToEndpoint(EXPORT_ENDPOINTS.traces, payload);
    
    if (result.success) {
        log.debug(`Exported ${traces.length} traces to ${EXPORT_ENDPOINTS.traces}`);
    } else {
        log.error(`Failed to export traces: ${result.error}`);
    }
    
    return result;
}

/**
 * Export logs to external backend
 */
async function exportLogs(logs) {
    if (!EXPORT_ENDPOINTS.logs || logs.length === 0) return;
    
    const payload = buildLogsPayload(logs);
    const result = await sendToEndpoint(EXPORT_ENDPOINTS.logs, payload);
    
    if (result.success) {
        log.debug(`Exported ${logs.length} logs to ${EXPORT_ENDPOINTS.logs}`);
    } else {
        log.error(`Failed to export logs: ${result.error}`);
    }
    
    return result;
}

/**
 * Export metrics to external backend
 */
async function exportMetrics(metrics) {
    if (!EXPORT_ENDPOINTS.metrics || metrics.length === 0) return;
    
    const payload = buildMetricsPayload(metrics);
    const result = await sendToEndpoint(EXPORT_ENDPOINTS.metrics, payload);
    
    if (result.success) {
        log.debug(`Exported ${metrics.length} metrics to ${EXPORT_ENDPOINTS.metrics}`);
    } else {
        log.error(`Failed to export metrics: ${result.error}`);
    }
    
    return result;
}

/**
 * Queue a trace for batched export
 */
function queueTrace(trace) {
    if (!EXPORT_ENABLED || !EXPORT_ENDPOINTS.traces) return;
    
    traceBatch.push(trace);
    
    if (traceBatch.length >= BATCH_SIZE) {
        flushTraces();
    } else {
        scheduleFlush();
    }
}

/**
 * Queue a log for batched export
 */
function queueLog(logEntry) {
    if (!EXPORT_ENABLED || !EXPORT_ENDPOINTS.logs) return;
    
    logBatch.push(logEntry);
    
    if (logBatch.length >= BATCH_SIZE) {
        flushLogs();
    } else {
        scheduleFlush();
    }
}

/**
 * Queue a metric for batched export
 */
function queueMetric(metric) {
    if (!EXPORT_ENABLED || !EXPORT_ENDPOINTS.metrics) return;
    
    metricBatch.push(metric);
    
    if (metricBatch.length >= BATCH_SIZE) {
        flushMetrics();
    } else {
        scheduleFlush();
    }
}

/**
 * Flush traces batch
 */
async function flushTraces() {
    if (traceBatch.length === 0) return;
    
    const batch = traceBatch;
    traceBatch = [];
    
    await exportTraces(batch);
}

/**
 * Flush logs batch
 */
async function flushLogs() {
    if (logBatch.length === 0) return;
    
    const batch = logBatch;
    logBatch = [];
    
    await exportLogs(batch);
}

/**
 * Flush metrics batch
 */
async function flushMetrics() {
    if (metricBatch.length === 0) return;
    
    const batch = metricBatch;
    metricBatch = [];
    
    await exportMetrics(batch);
}

/**
 * Flush all batches
 */
async function flushAll() {
    await Promise.all([
        flushTraces(),
        flushLogs(),
        flushMetrics()
    ]);
}

/**
 * Schedule periodic flush
 */
function scheduleFlush() {
    if (flushTimer) return;
    
    flushTimer = setTimeout(async () => {
        flushTimer = null;
        await flushAll();
    }, FLUSH_INTERVAL_MS);
}

/**
 * Get export configuration
 */
function getConfig() {
    return {
        enabled: EXPORT_ENABLED,
        endpoints: EXPORT_ENDPOINTS,
        batchSize: BATCH_SIZE,
        flushIntervalMs: FLUSH_INTERVAL_MS,
        hasTraces: !!EXPORT_ENDPOINTS.traces,
        hasLogs: !!EXPORT_ENDPOINTS.logs,
        hasMetrics: !!EXPORT_ENDPOINTS.metrics
    };
}

/**
 * Initialize export hooks
 */
function initExportHooks(db) {
    if (!EXPORT_ENABLED) {
        log.info('OTLP export disabled');
        return;
    }
    
    log.info(`OTLP export enabled: traces=${!!EXPORT_ENDPOINTS.traces}, logs=${!!EXPORT_ENDPOINTS.logs}, metrics=${!!EXPORT_ENDPOINTS.metrics}`);
    
    if (EXPORT_ENDPOINTS.traces) {
        db.setInsertTraceHook((trace) => {
            queueTrace(trace);
        });
    }
    
    if (EXPORT_ENDPOINTS.logs) {
        db.setInsertLogHook((logEntry) => {
            queueLog(logEntry);
        });
    }
    
    if (EXPORT_ENDPOINTS.metrics) {
        db.setInsertMetricHook((metric) => {
            queueMetric(metric);
        });
    }
    
    process.on('beforeExit', async () => {
        await flushAll();
    });
}

module.exports = {
    exportTraces,
    exportLogs,
    exportMetrics,
    queueTrace,
    queueLog,
    queueMetric,
    flushAll,
    getConfig,
    initExportHooks,
    buildTracesPayload,
    buildLogsPayload,
    buildMetricsPayload,
    traceToOtlpSpan,
    logToOtlpRecord,
    metricToOtlpMetric,
    EXPORT_ENABLED
};
