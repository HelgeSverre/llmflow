const { Root } = require('protobufjs/light')
const { gunzipSync } = require('node:zlib')
// Generated from opentelemetry-proto v1.11.0. See ../PROTO-LICENSE.
const root = Root.fromJSON(require('./proto.json'))
const INPUT_LIMIT = 4 * 1024 * 1024
const OUTPUT_LIMIT = 16 * 1024 * 1024
function fail(status, message) {
    throw Object.assign(new Error(message), { status })
}
function messageType(signal, suffix) {
    const name = { trace: 'Trace', logs: 'Logs', metrics: 'Metrics' }[signal]
    return root.lookupType(
        `opentelemetry.proto.collector.${signal}.v1.Export${name}Service${suffix}`,
    )
}
function normalizeIds(value) {
    if (!value || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
        if (['traceId', 'spanId', 'parentSpanId'].includes(key) && typeof item === 'string') {
            value[key] = Buffer.from(item, 'base64').toString('hex')
        } else normalizeIds(item)
    }
}
function validateContainers(value, fields) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Expected object')
    if (!fields.length) return
    const entries = value[fields[0]]
    if (entries === undefined) return
    if (!Array.isArray(entries)) throw new Error('Expected array')
    for (const entry of entries) validateContainers(entry, fields.slice(1))
}
async function decodeOtlpRequest(request, signal) {
    const contentType = (request.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase()
    if (!['application/json', 'application/x-protobuf'].includes(contentType))
        fail(415, 'Use application/json or application/x-protobuf')
    const encoding = (request.headers.get('content-encoding') || 'identity').trim().toLowerCase()
    if (!['identity', 'gzip'].includes(encoding)) fail(415, 'Use identity or gzip content encoding')
    if (Number(request.headers.get('content-length')) > INPUT_LIMIT)
        fail(413, 'OTLP request exceeds 4 MiB')
    const chunks = []
    let length = 0
    if (request.body) {
        const reader = request.body.getReader()
        try {
            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                length += value.length
                if (length > INPUT_LIMIT) {
                    await reader.cancel()
                    fail(413, 'OTLP request exceeds 4 MiB')
                }
                chunks.push(value)
            }
        } finally {
            reader.releaseLock()
        }
    }
    let bytes = Buffer.concat(chunks)
    if (encoding === 'gzip') {
        try {
            bytes = gunzipSync(bytes, { maxOutputLength: OUTPUT_LIMIT })
        } catch (error) {
            fail(
                error.code === 'ERR_BUFFER_TOO_LARGE' ? 413 : 400,
                'Invalid or oversized gzip OTLP body',
            )
        }
    }
    let body
    const protobuf = contentType === 'application/x-protobuf'
    try {
        if (protobuf) {
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
        validateContainers(
            body,
            {
                trace: ['resourceSpans', 'scopeSpans', 'spans'],
                logs: ['resourceLogs', 'scopeLogs', 'logRecords'],
                metrics: ['resourceMetrics', 'scopeMetrics', 'metrics'],
            }[signal],
        )
    } catch {
        fail(400, 'Malformed OTLP body')
    }
    return {
        body,
        respond(value) {
            if (!protobuf) return Response.json(value)
            const type = messageType(signal, 'Response')
            return new Response(type.encode(type.fromObject(value)).finish(), {
                headers: { 'Content-Type': contentType },
            })
        },
    }
}
module.exports = { decodeOtlpRequest, messageType }
