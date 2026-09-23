import { DEFAULT_SERVICE_NAME } from '@llmflow/shared/config'
import type { AnyValue, Attributes, KeyValue } from './types'

export function extractAnyValue(value: AnyValue | undefined): unknown {
    if (!value) return null
    if (value.stringValue !== undefined) return value.stringValue
    if (value.intValue !== undefined) return Number(value.intValue)
    if (value.doubleValue !== undefined) return value.doubleValue
    if (value.boolValue !== undefined) return value.boolValue
    if (value.bytesValue !== undefined) return value.bytesValue
    if (value.arrayValue) return (value.arrayValue.values || []).map(extractAnyValue)
    if (value.kvlistValue) return extractAttributes(value.kvlistValue.values)
    return null
}

export function extractAttributes(attrs: KeyValue[] | undefined): Attributes {
    if (!Array.isArray(attrs)) return {}
    return Object.fromEntries(
        attrs.filter((attr) => attr?.value).map(({ key, value }) => [key, extractAnyValue(value)]),
    )
}

// Every ingest path attributes records to the resource's service.name, or OpenTelemetry's
// default 'unknown_service'.
export function serviceName(resourceAttrs: Attributes): string {
    const name = resourceAttrs['service.name']
    return typeof name === 'string' && name ? name : DEFAULT_SERVICE_NAME
}
