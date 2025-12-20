/**
 * OTLP Logs Endpoint for LLMFlow
 * 
 * Accepts OTLP/HTTP JSON logs and stores them for AI CLI tool observability.
 * Supports log events from Claude Code, Codex CLI, Gemini CLI, etc.
 * 
 * Supports:
 * - OTLP/HTTP JSON format (Content-Type: application/json)
 * - event.name extraction for AI CLI tools
 * - Correlation with traces via trace_id/span_id
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

/**
 * Extract attributes from OTLP KeyValue array format
 * OTLP attributes are: [{ key: "foo", value: { stringValue: "bar" } }, ...]
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
 * Convert hex string to normalized format
 */
function normalizeId(hexId) {
    if (!hexId) return null;
    return hexId.replace(/-/g, '').toLowerCase();
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
 * Extract log body from OTLP AnyValue format
 */
function extractBody(body) {
    if (!body) return null;
    
    if (body.stringValue !== undefined) return body.stringValue;
    if (body.intValue !== undefined) return String(body.intValue);
    if (body.doubleValue !== undefined) return String(body.doubleValue);
    if (body.boolValue !== undefined) return String(body.boolValue);
    if (body.arrayValue?.values) {
        return JSON.stringify(body.arrayValue.values.map(v => 
            v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? null
        ));
    }
    if (body.kvlistValue?.values) {
        const obj = {};
        for (const kv of body.kvlistValue.values) {
            obj[kv.key] = kv.value?.stringValue ?? kv.value?.intValue ?? kv.value?.doubleValue ?? null;
        }
        return JSON.stringify(obj);
    }
    if (body.bytesValue) {
        return `[binary: ${body.bytesValue.length} bytes]`;
    }
    
    return JSON.stringify(body);
}

/**
 * Extract event name from log attributes
 * Common patterns for AI CLI tools
 */
function extractLogEventName(attrs) {
    return attrs['event.name'] 
        || attrs['log.event.name']
        || attrs['name']
        || attrs['event_name']
        || null;
}

/**
 * Map OTLP severity number to text if not provided
 * Per OTEL spec: https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
 */
function getSeverityText(severityNumber, providedText) {
    if (providedText) return providedText;
    if (!severityNumber) return null;
    
    const severityMap = {
        1: 'TRACE', 2: 'TRACE', 3: 'TRACE', 4: 'TRACE',
        5: 'DEBUG', 6: 'DEBUG', 7: 'DEBUG', 8: 'DEBUG',
        9: 'INFO', 10: 'INFO', 11: 'INFO', 12: 'INFO',
        13: 'WARN', 14: 'WARN', 15: 'WARN', 16: 'WARN',
        17: 'ERROR', 18: 'ERROR', 19: 'ERROR', 20: 'ERROR',
        21: 'FATAL', 22: 'FATAL', 23: 'FATAL', 24: 'FATAL'
    };
    
    return severityMap[severityNumber] || 'UNSPECIFIED';
}

/**
 * Process OTLP/HTTP JSON logs request
 * 
 * Expected format (OTLP/HTTP JSON):
 * {
 *   "resourceLogs": [
 *     {
 *       "resource": { "attributes": [...] },
 *       "scopeLogs": [
 *         {
 *           "scope": { "name": "...", "version": "..." },
 *           "logRecords": [
 *             {
 *               "timeUnixNano": "...",
 *               "observedTimeUnixNano": "...",
 *               "severityNumber": 9,
 *               "severityText": "INFO",
 *               "body": { "stringValue": "..." },
 *               "attributes": [...],
 *               "traceId": "hex",
 *               "spanId": "hex"
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
function processOtlpLogs(body) {
    const results = {
        accepted: 0,
        rejected: 0,
        errors: []
    };
    
    if (!body || !body.resourceLogs) {
        return results;
    }
    
    for (const resourceLog of body.resourceLogs) {
        const resourceAttrs = extractAttributes(resourceLog.resource?.attributes);
        
        for (const scopeLog of (resourceLog.scopeLogs || [])) {
            const scopeInfo = scopeLog.scope || {};
            
            for (const logRecord of (scopeLog.logRecords || [])) {
                try {
                    const attrs = extractAttributes(logRecord.attributes);
                    const logId = uuidv4();
                    
                    db.insertLog({
                        id: logId,
                        timestamp: nanoToMs(logRecord.timeUnixNano),
                        observed_timestamp: nanoToMs(logRecord.observedTimeUnixNano),
                        severity_number: logRecord.severityNumber || null,
                        severity_text: getSeverityText(logRecord.severityNumber, logRecord.severityText),
                        body: extractBody(logRecord.body),
                        trace_id: normalizeId(logRecord.traceId),
                        span_id: normalizeId(logRecord.spanId),
                        event_name: extractLogEventName(attrs),
                        service_name: resourceAttrs['service.name'] || 'unknown',
                        scope_name: scopeInfo.name || null,
                        attributes: attrs,
                        resource_attributes: resourceAttrs
                    });
                    results.accepted++;
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
 * Express middleware for OTLP logs endpoint
 */
function createLogsHandler() {
    return (req, res) => {
        const contentType = req.headers['content-type'] || '';
        
        if (!contentType.includes('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Only application/json is supported. Use OTLP/HTTP JSON format.'
            });
        }
        
        try {
            const results = processOtlpLogs(req.body);
            
            res.status(200).json({
                partialSuccess: results.rejected > 0 ? {
                    rejectedLogRecords: results.rejected,
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
    processOtlpLogs,
    createLogsHandler,
    extractAttributes,
    extractBody,
    extractLogEventName,
    normalizeId,
    nanoToMs
};
