// OTLP/HTTP receiver: POST /v1/traces, /v1/logs and /v1/metrics (JSON or protobuf, optionally gzip).
import { processOtlpLogs } from '@llmflow/otlp/logs'
import { processOtlpMetrics } from '@llmflow/otlp/metrics'
import { processOtlpTraces } from '@llmflow/otlp/traces'
import { decodeOtlpRequest } from '@llmflow/otlp/transport'
import { log } from '@llmflow/shared/logger'

const SIGNALS = {
    '/v1/traces': { signal: 'trace', process: processOtlpTraces, rejected: 'rejectedSpans' },
    '/v1/logs': { signal: 'logs', process: processOtlpLogs, rejected: 'rejectedLogRecords' },
    '/v1/metrics': {
        signal: 'metrics',
        process: processOtlpMetrics,
        rejected: 'rejectedDataPoints',
    },
} as const

export function isOtlpPath(pathname: string) {
    return ['/v1/traces', '/v1/logs', '/v1/metrics'].some((prefix) => pathname.startsWith(prefix))
}

export async function handleOtlpRoute(req: Request, url: URL): Promise<Response> {
    const route = SIGNALS[url.pathname as keyof typeof SIGNALS]
    if (!route) return Response.json({ error: 'Not Found' }, { status: 404 })
    if (req.method !== 'POST')
        return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    try {
        const { body, respond } = await decodeOtlpRequest(req, route.signal)
        const results = route.process(body)
        return respond(
            results.rejected
                ? {
                      partialSuccess: {
                          [route.rejected]: String(results.rejected),
                          errorMessage: results.errors.slice(0, 5).join('; '),
                      },
                  }
                : {},
        )
    } catch (error) {
        const failure = error as Error & { status?: number }
        if (!failure.status) log.error(`OTLP error: ${failure.message}`)
        return Response.json({ error: failure.message }, { status: failure.status || 500 })
    }
}
