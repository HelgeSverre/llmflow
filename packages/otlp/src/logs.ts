// OTLP/HTTP logs ingestion: AI CLI tools (Claude Code, Codex, Gemini CLI) emit their events as logs.
import * as db from '@llmflow/db'
import { extractAttributes, serviceName } from './attributes'
import { normalizeId } from './ids'
import { nanoToMs } from './timestamps'
import type { AnyValue, Attributes, IngestResult, LogsRequest } from './types'

// Unlike attribute values, log bodies keep integers as strings.
function extractBody(body: AnyValue | undefined): unknown {
    if (!body) return null
    if (body.stringValue !== undefined) return body.stringValue
    if (body.intValue !== undefined) return String(body.intValue)
    if (body.doubleValue !== undefined) return body.doubleValue
    if (body.boolValue !== undefined) return body.boolValue
    if (body.arrayValue?.values) return body.arrayValue.values.map(extractBody)
    if (body.kvlistValue?.values)
        return Object.fromEntries(
            body.kvlistValue.values.map(({ key, value }) => [key, extractBody(value)]),
        )
    if (body.bytesValue !== undefined) return body.bytesValue
    return null
}

function extractEventName(attrs: Attributes) {
    return (attrs['event.name'] ||
        attrs['log.event.name'] ||
        attrs['name'] ||
        attrs['event_name'] ||
        null) as string | null
}

const SEVERITY_TEXT = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

// https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
function severityText(severityNumber: number | undefined, provided: string | undefined) {
    if (provided) return provided
    if (!severityNumber) return null
    if (!Number.isInteger(severityNumber)) return 'UNSPECIFIED'
    return SEVERITY_TEXT[Math.floor((severityNumber - 1) / 4)] ?? 'UNSPECIFIED'
}

export function processOtlpLogs(body: LogsRequest): IngestResult {
    const results: IngestResult = { accepted: 0, rejected: 0, errors: [] }
    for (const resourceLog of body?.resourceLogs || []) {
        const resourceAttrs = extractAttributes(resourceLog.resource?.attributes)
        for (const scopeLog of resourceLog.scopeLogs || []) {
            const scope = scopeLog.scope || {}
            for (const record of scopeLog.logRecords || []) {
                try {
                    const attrs = extractAttributes(record.attributes)
                    db.insertLog({
                        id: crypto.randomUUID(),
                        timestamp:
                            nanoToMs(record.timeUnixNano) ??
                            nanoToMs(record.observedTimeUnixNano) ??
                            Date.now(),
                        observed_timestamp: nanoToMs(record.observedTimeUnixNano),
                        severity_number: record.severityNumber || null,
                        severity_text: severityText(record.severityNumber, record.severityText),
                        body: extractBody(record.body),
                        trace_id: normalizeId(record.traceId),
                        span_id: normalizeId(record.spanId),
                        event_name: extractEventName(attrs),
                        service_name: serviceName(resourceAttrs),
                        scope_name: scope.name || null,
                        attributes: attrs,
                        resource_attributes: resourceAttrs,
                    })
                    results.accepted++
                } catch (error) {
                    results.rejected++
                    results.errors.push((error as Error).message)
                }
            }
        }
    }
    return results
}
