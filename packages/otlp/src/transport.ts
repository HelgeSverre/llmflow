import { gunzipSync } from 'node:zlib'
import { readBoundedBody } from '@llmflow/shared/body'
import protobuf from 'protobufjs/light'
import { base64IdToHex } from './ids'
// Generated from opentelemetry-proto v1.11.0. License: licenses/opentelemetry-proto.txt at the repository root.
import protoJson from './proto.json' with { type: 'json' }

export type Signal = 'trace' | 'logs' | 'metrics'

const root = protobuf.Root.fromJSON(protoJson as protobuf.INamespace)
const INPUT_LIMIT = 4 * 1024 * 1024
const OUTPUT_LIMIT = 16 * 1024 * 1024
const ID_FIELDS = new Set(['traceId', 'spanId', 'parentSpanId'])
const CONTAINERS: Record<Signal, string[]> = {
    trace: ['resourceSpans', 'scopeSpans', 'spans'],
    logs: ['resourceLogs', 'scopeLogs', 'logRecords'],
    metrics: ['resourceMetrics', 'scopeMetrics', 'metrics'],
}

function fail(status: number, message: string): never {
    throw Object.assign(new Error(message), { status })
}

export function messageType(signal: Signal, suffix: 'Request' | 'Response') {
    const name = { trace: 'Trace', logs: 'Logs', metrics: 'Metrics' }[signal]
    return root.lookupType(
        `opentelemetry.proto.collector.${signal}.v1.Export${name}Service${suffix}`,
    )
}

function normalizeIds(value: unknown) {
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    for (const [key, item] of Object.entries(record)) {
        if (ID_FIELDS.has(key) && typeof item === 'string') record[key] = base64IdToHex(item)
        else normalizeIds(item)
    }
}

function validateContainers(value: unknown, fields: string[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Expected object')
    const [field, ...rest] = fields
    if (!field) return
    const entries = (value as Record<string, unknown>)[field]
    if (entries === undefined) return
    if (!Array.isArray(entries)) throw new Error('Expected array')
    for (const entry of entries) validateContainers(entry, rest)
}

export async function decodeOtlpRequest(request: Request, signal: Signal) {
    const contentType = (request.headers.get('content-type') || '')
        .split(';')[0]!
        .trim()
        .toLowerCase()
    if (!['application/json', 'application/x-protobuf'].includes(contentType))
        fail(415, 'Use application/json or application/x-protobuf')
    const encoding = (request.headers.get('content-encoding') || 'identity').trim().toLowerCase()
    if (!['identity', 'gzip'].includes(encoding)) fail(415, 'Use identity or gzip content encoding')
    if (Number(request.headers.get('content-length')) > INPUT_LIMIT)
        fail(413, 'OTLP request exceeds 4 MiB')

    let bytes = await readBoundedBody(request.body, INPUT_LIMIT)
    if (!bytes) fail(413, 'OTLP request exceeds 4 MiB')
    if (encoding === 'gzip') {
        try {
            bytes = gunzipSync(bytes, { maxOutputLength: OUTPUT_LIMIT })
        } catch (error) {
            fail(
                (error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE' ? 413 : 400,
                'Invalid or oversized gzip OTLP body',
            )
        }
    }

    let body: Record<string, unknown>
    const isProtobuf = contentType === 'application/x-protobuf'
    try {
        if (isProtobuf) {
            const type = messageType(signal, 'Request')
            body = type.toObject(type.decode(bytes), {
                longs: String,
                bytes: String,
                enums: Number,
            })
            normalizeIds(body)
        } else body = JSON.parse(bytes.toString('utf8'))
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw new Error('Expected an object')
        validateContainers(body, CONTAINERS[signal])
    } catch {
        fail(400, 'Malformed OTLP body')
    }

    return {
        body,
        respond(value: Record<string, unknown>) {
            if (!isProtobuf) return Response.json(value)
            const type = messageType(signal, 'Response')
            return new Response(Buffer.from(type.encode(type.fromObject(value)).finish()), {
                headers: { 'Content-Type': contentType },
            })
        },
    }
}
