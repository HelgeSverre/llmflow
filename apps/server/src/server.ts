import * as db from '@llmflow/db'
import { safeJson } from '@llmflow/db'
import path from 'path'
import fs from 'fs'
import { forwardProxyRequest } from './proxy'
import { replayTrace } from './replay'
import { trustedWebSocketOrigin } from './websocket-origin'

import { registry } from '@llmflow/providers'
import {
    type PassthroughHandler,
    AnthropicPassthrough,
    GeminiPassthrough,
    OpenAIPassthrough,
    HeliconePassthrough,
} from '@llmflow/providers/passthrough'
// CommonJS workspace packages
const { getPricingStatus } = require('@llmflow/pricing')
const log = require('@llmflow/shared/logger')
const { processOtlpTraces } = require('@llmflow/otlp/traces')
const { decodeOtlpRequest } = require('@llmflow/otlp/transport')
const { processOtlpLogs } = require('@llmflow/otlp/logs')
const { processOtlpMetrics } = require('@llmflow/otlp/metrics')
const { initExportHooks, flushAll, EXPORT_ENABLED } = require('@llmflow/otlp/export')

// Passthrough handlers for native API formats
const passthroughHandlers: Record<string, PassthroughHandler> = {
    anthropic: new AnthropicPassthrough(),
    gemini: new GeminiPassthrough(),
    openai: new OpenAIPassthrough(),
    helicone: new HeliconePassthrough(),
}

const PROXY_HOST = process.env.PROXY_HOST || '127.0.0.1'
const DASHBOARD_HOST = process.env.DASHBOARD_HOST || '127.0.0.1'
function configuredPort(name: string, fallback: number) {
    const value = Number(process.env[name] ?? fallback)
    if (!Number.isInteger(value) || value < 0 || value > 65535)
        throw new Error(`${name} must be a port from 0 to 65535`)
    return value
}
const PROXY_PORT = configuredPort('PROXY_PORT', 8080)
const DASHBOARD_PORT = configuredPort('DASHBOARD_PORT', 1337)

// WebSocket clients for real-time updates
const wsClients = new Set<{ send: (data: string) => void }>()

function broadcast(data: unknown) {
    const message = JSON.stringify(data)
    for (const client of wsClients) {
        try {
            client.send(message)
        } catch {
            wsClients.delete(client)
        }
    }
}

// Throttle stats updates (max once per second)
let lastStatsUpdate = 0
const STATS_THROTTLE_MS = 1000

// Set up real-time hooks
db.subscribeTraces((record) => {
    const trace = db.traceSummary(record)
    // Broadcast new span (for all spans)
    broadcast({ type: 'new_span', payload: trace })

    // If root span, also broadcast new_trace
    if (!trace.parent_id) {
        broadcast({ type: 'new_trace', payload: trace })
    }

    // Throttled stats update
    const now = Date.now()
    if (now - lastStatsUpdate > STATS_THROTTLE_MS) {
        lastStatsUpdate = now
        const stats = db.getStats()
        broadcast({ type: 'stats_update', payload: stats })
    }
})

db.subscribeLogs((record) => {
    const log = db.logSummary(record)
    broadcast({ type: 'new_log', payload: log })

    // If log has trace_id, notify trace subscribers
    if (log.trace_id) {
        broadcast({
            type: 'trace_log_added',
            payload: { trace_id: log.trace_id, log },
        })
    }
})

db.subscribeMetrics((record) => {
    const metric = db.metricSummary(record)
    broadcast({ type: 'new_metric', payload: metric })
})

// Static file serving
// Dashboard build output lives at the monorepo root /public/ so it can be
// included in the npm package via root `files` and served unchanged in
// production/dev. apps/server/src → repo root is three levels up.
const publicDir = path.join(
    process.env.LLMFLOW_ROOT || path.resolve(import.meta.dir, '../../..'),
    'public',
)

function serveStaticFile(filePath: string): Response {
    const fullPath = path.join(publicDir, filePath)

    try {
        if (!fs.existsSync(fullPath)) {
            return new Response('Not Found', { status: 404 })
        }

        const file = Bun.file(fullPath)
        return new Response(file)
    } catch {
        return new Response('Not Found', { status: 404 })
    }
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    }
    return mimeTypes[ext] || 'application/octet-stream'
}

// Dashboard server
export function startDashboardServer() {
    return Bun.serve({
        hostname: DASHBOARD_HOST,
        port: DASHBOARD_PORT,

        websocket: {
            open(ws) {
                wsClients.add(ws)
                ws.send(JSON.stringify({ type: 'hello', time: Date.now() }))
            },
            message(_ws, _message) {
                // Handle client messages if needed
            },
            close(ws) {
                wsClients.delete(ws)
            },
        },

        async fetch(req, server) {
            const url = new URL(req.url)
            const pathname = url.pathname

            // WebSocket upgrade
            if (pathname === '/ws') {
                if (!trustedWebSocketOrigin(req, DASHBOARD_HOST, server.port!)) {
                    return new Response('Untrusted WebSocket origin', { status: 403 })
                }
                if (server.upgrade(req)) return new Response(null)
                return new Response('WebSocket upgrade failed', { status: 400 })
            }

            // API routes
            if (pathname.startsWith('/api/')) {
                return handleApiRoute(req, url)
            }

            // OTLP routes
            if (
                pathname.startsWith('/v1/traces') ||
                pathname.startsWith('/v1/logs') ||
                pathname.startsWith('/v1/metrics')
            ) {
                return handleOtlpRoute(req, url)
            }

            // Static files
            if (pathname === '/' || pathname === '/index.html') {
                return serveStaticFile('index.html')
            }

            return serveStaticFile(pathname)
        },
    })
}

// Sanitize analytics data to ensure no null values that break frontend
function sanitizeByTool(data: unknown[]): unknown[] {
    return (data as Record<string, unknown>[]).map((item) => ({
        ...item,
        provider: item.provider || 'unknown',
        service_name: item.service_name || 'unknown',
    }))
}

function sanitizeByModel(data: unknown[]): unknown[] {
    return (data as Record<string, unknown>[]).map((item) => ({
        ...item,
        model: item.model || 'unknown',
        provider: item.provider || 'unknown',
    }))
}

// Provider health check using fetch
async function handleProviderHealthCheck(): Promise<Response> {
    interface HealthResult {
        status: 'ok' | 'error' | 'unconfigured'
        latency_ms?: number
        message?: string
    }

    const results: Record<string, HealthResult> = {}

    const checkProvider = async (
        name: string,
        checkFn: () => Promise<{ ok: boolean; message?: string }>,
    ): Promise<HealthResult> => {
        try {
            const start = Date.now()
            const result = await checkFn()
            return {
                status: result.ok ? 'ok' : 'error',
                latency_ms: Date.now() - start,
                message: result.message || undefined,
            }
        } catch (err) {
            return { status: 'error', message: (err as Error).message }
        }
    }

    // Check OpenAI
    if (process.env.OPENAI_API_KEY) {
        results.openai = await checkProvider('openai', async () => {
            try {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 5000)
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
                    signal: controller.signal,
                })
                clearTimeout(timeout)
                return { ok: res.status === 200 }
            } catch (e) {
                return { ok: false, message: (e as Error).message }
            }
        })
    } else {
        results.openai = { status: 'unconfigured', message: 'OPENAI_API_KEY not set' }
    }

    // Check Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
        results.anthropic = await checkProvider('anthropic', async () => {
            try {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 5000)
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': process.env.ANTHROPIC_API_KEY!,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json',
                    },
                    body: '{}',
                    signal: controller.signal,
                })
                clearTimeout(timeout)
                // 400 means API key is valid but request body invalid (expected)
                return { ok: res.status === 400 || res.status === 200 }
            } catch (e) {
                return { ok: false, message: (e as Error).message }
            }
        })
    } else {
        results.anthropic = { status: 'unconfigured', message: 'ANTHROPIC_API_KEY not set' }
    }

    // Check Gemini
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (geminiKey) {
        results.gemini = await checkProvider('gemini', async () => {
            try {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 5000)
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
                    {
                        signal: controller.signal,
                    },
                )
                clearTimeout(timeout)
                return { ok: res.status === 200 }
            } catch (e) {
                return { ok: false, message: (e as Error).message }
            }
        })
    } else {
        results.gemini = {
            status: 'unconfigured',
            message: 'GOOGLE_API_KEY/GEMINI_API_KEY not set',
        }
    }

    // Check Groq
    if (process.env.GROQ_API_KEY) {
        results.groq = await checkProvider('groq', async () => {
            try {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 5000)
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
                    signal: controller.signal,
                })
                clearTimeout(timeout)
                return { ok: res.status === 200 }
            } catch (e) {
                return { ok: false, message: (e as Error).message }
            }
        })
    } else {
        results.groq = { status: 'unconfigured', message: 'GROQ_API_KEY not set' }
    }

    // Check Ollama (local, no API key needed)
    const ollamaHost = process.env.OLLAMA_HOST || 'localhost'
    const ollamaPort = process.env.OLLAMA_PORT || '11434'
    results.ollama = await checkProvider('ollama', async () => {
        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 2000)
            const res = await fetch(`http://${ollamaHost}:${ollamaPort}/api/tags`, {
                signal: controller.signal,
            })
            clearTimeout(timeout)
            return { ok: res.status === 200 }
        } catch {
            return { ok: false, message: `not reachable at ${ollamaHost}:${ollamaPort}` }
        }
    })

    const okCount = Object.values(results).filter((r) => r.status === 'ok').length
    const totalConfigured = Object.values(results).filter((r) => r.status !== 'unconfigured').length

    return Response.json({
        summary: `${okCount}/${totalConfigured} providers healthy`,
        providers: results,
    })
}

// API route handler
async function handleApiRoute(req: Request, url: URL): Promise<Response> {
    const pathname = url.pathname
    const method = req.method

    try {
        // Health check
        if (pathname === '/api/health' && method === 'GET') {
            return Response.json({
                status: 'ok',
                timestamp: Date.now(),
                pricing: getPricingStatus(),
            })
        }

        // Provider health check
        if (pathname === '/api/health/providers' && method === 'GET') {
            return await handleProviderHealthCheck()
        }

        // Stats
        if (pathname === '/api/stats' && method === 'GET') {
            const stats = db.getStats()
            return Response.json(stats)
        }

        // Models
        if (pathname === '/api/models' && method === 'GET') {
            const stats = db.getStats()
            const models = (
                (stats.models || []) as Array<{
                    model: string
                    count: number
                    tokens: number
                    prompt_tokens: number
                    completion_tokens: number
                    avg_latency: number
                    cost: number
                }>
            ).map((m) => ({
                model: m.model,
                request_count: m.count || 0,
                total_tokens: m.tokens || 0,
                prompt_tokens: m.prompt_tokens ?? 0,
                completion_tokens: m.completion_tokens ?? 0,
                total_cost: m.cost || 0,
                avg_latency: m.avg_latency ?? null,
            }))
            return Response.json(models)
        }

        // Traces list
        if (pathname === '/api/traces' && method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || '50')
            const offset = Number(url.searchParams.get('offset') || '0')

            const filters: db.TraceFilters = {}
            if (url.searchParams.get('model')) filters.model = url.searchParams.get('model')!
            if (url.searchParams.get('status')) filters.status = url.searchParams.get('status')!
            if (url.searchParams.get('q')) filters.q = url.searchParams.get('q')!
            if (url.searchParams.get('date_from'))
                filters.date_from = Number(url.searchParams.get('date_from'))
            if (url.searchParams.get('date_to'))
                filters.date_to = Number(url.searchParams.get('date_to'))
            if (url.searchParams.get('provider'))
                filters.provider = url.searchParams.get('provider')!
            if (url.searchParams.get('trace_id'))
                filters.trace_id = url.searchParams.get('trace_id')!
            if (url.searchParams.get('session_id'))
                filters.session_id = url.searchParams.get('session_id')!
            if (url.searchParams.get('conversation_id'))
                filters.conversation_id = url.searchParams.get('conversation_id')!

            const traces = db.getTraces({ limit, offset, filters })
            return Response.json(traces)
        }

        if (pathname.match(/^\/api\/traces\/[^/]+\/replay$/) && method === 'POST') {
            try {
                return await replayTrace(decodeURIComponent(pathname.split('/')[3]), req.signal)
            } catch (error) {
                log.error('Replay failed', error)
                return Response.json(
                    { error: 'Replay failed. Check the server log and provider configuration.' },
                    { status: 502 },
                )
            }
        }

        // Single trace
        if (pathname.match(/^\/api\/traces\/[^/]+$/) && method === 'GET') {
            const id = pathname.split('/').pop()!
            const trace = db.getTraceById(id)

            if (!trace) {
                return Response.json({ error: 'Trace not found' }, { status: 404 })
            }

            const t = trace as Record<string, unknown>
            return Response.json({
                trace: {
                    id: t.id,
                    trace_id: t.trace_id,
                    span_name: t.span_name,
                    span_type: t.span_type,
                    service_name: t.service_name,
                    input: safeJson(t.input, null),
                    output: safeJson(t.output, null),
                    attributes: safeJson(t.attributes, {}),
                    timestamp: t.timestamp,
                    duration_ms: t.duration_ms,
                    model: t.model,
                    prompt_tokens: t.prompt_tokens,
                    completion_tokens: t.completion_tokens,
                    total_tokens: t.total_tokens,
                    status: t.status,
                    error: t.error,
                    estimated_cost: t.estimated_cost,
                },
                request: {
                    method: t.request_method,
                    path: t.request_path,
                    headers: safeJson(t.request_headers, {}),
                    body: safeJson(t.request_body, {}),
                },
                response: {
                    status: t.response_status,
                    headers: safeJson(t.response_headers, {}),
                    body: safeJson(t.response_body, {}),
                },
            })
        }

        // Trace tree (spans)
        if (pathname.match(/^\/api\/traces\/[^/]+\/tree$/) && method === 'GET') {
            const id = pathname.split('/')[3]

            const rootSpan = db.getTraceById(id)
            if (!rootSpan) {
                return Response.json({ error: 'Span not found' }, { status: 404 })
            }

            const traceId = ((rootSpan as Record<string, unknown>).trace_id as string) || id
            const spans = db.getSpansByTraceId(traceId) as Record<string, unknown>[]

            // Parse JSON fields and add children array
            type ParsedSpan = Record<string, unknown> & { children: ParsedSpan[] }
            const parsedSpans: ParsedSpan[] = spans.map((s) => ({
                ...s,
                request_headers: safeJson(s.request_headers, {}),
                request_body: safeJson(s.request_body, {}),
                response_headers: safeJson(s.response_headers, {}),
                response_body: safeJson(s.response_body, {}),
                input: safeJson(s.input, null),
                output: safeJson(s.output, null),
                attributes: safeJson(s.attributes, {}),
                tags: safeJson<unknown[]>(s.tags, []),
                children: [] as ParsedSpan[],
            }))

            // Build tree
            const byId = new Map<string, (typeof parsedSpans)[0]>()
            parsedSpans.forEach((s) => byId.set(s.id as string, s))
            const roots: typeof parsedSpans = []

            for (const span of parsedSpans) {
                if (span.parent_id && byId.has(span.parent_id as string)) {
                    byId.get(span.parent_id as string)!.children.push(span)
                } else {
                    roots.push(span)
                }
            }

            const missingParents = spans
                .filter((span) => span.parent_id && !byId.has(span.parent_id as string))
                .map((span) => span.parent_id)
            const partial = missingParents.length > 0 || db.wasTraceEvicted(traceId)

            // Aggregate stats
            const totalCost = spans.reduce((acc, s) => acc + ((s.estimated_cost as number) || 0), 0)
            const totalTokens = spans.reduce((acc, s) => acc + ((s.total_tokens as number) || 0), 0)
            const startTs = Math.min(...spans.map((s) => s.timestamp as number))
            const timingComplete = spans.every((s) => s.duration_ms != null)
            const endTs = timingComplete
                ? Math.max(...spans.map((s) => (s.timestamp as number) + (s.duration_ms as number)))
                : null

            return Response.json({
                trace: {
                    trace_id: traceId,
                    partial,
                    missing_parent_ids: missingParents,
                    start_time: startTs,
                    end_time: endTs,
                    duration_ms: endTs == null ? null : endTs - startTs,
                    total_cost: totalCost,
                    total_tokens: totalTokens,
                    span_count: spans.length,
                },
                spans: roots,
            })
        }

        // Sessions list
        if (pathname === '/api/sessions' && method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || '50')
            const offset = Number(url.searchParams.get('offset') || '0')
            return Response.json({
                sessions: db.getSessions({ limit, offset }),
                total: db.getSessionCount(),
            })
        }

        // Session detail
        if (pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'GET') {
            const id = decodeURIComponent(pathname.split('/').pop()!)
            const traces = db.getSessionTraces(id)
            if (!traces.length)
                return Response.json({ error: 'Session not found' }, { status: 404 })

            type Totals = { cost: number; tokens: number; spans: number; errors: number }
            const totals = (traces as Record<string, unknown>[]).reduce<Totals>(
                (acc, t) => ({
                    cost: acc.cost + ((t.cost as number) || 0),
                    tokens: acc.tokens + ((t.tokens as number) || 0),
                    spans: acc.spans + ((t.span_count as number) || 0),
                    errors: acc.errors + ((t.has_error as number) || 0),
                }),
                { cost: 0, tokens: 0, spans: 0, errors: 0 },
            )

            return Response.json({
                session_id: id,
                traces,
                summary: totals,
            })
        }

        // Timeline
        if (pathname === '/api/timeline' && method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || '100')
            const filters: db.TraceFilters = {}
            if (url.searchParams.get('q')) filters.q = url.searchParams.get('q')!
            if (url.searchParams.get('tool')) filters.service_name = url.searchParams.get('tool')!
            if (url.searchParams.get('date_from'))
                filters.date_from = Number(url.searchParams.get('date_from'))

            const type = url.searchParams.get('type') || ''
            const items: unknown[] = []

            if (!type || type === 'trace') {
                const traces = db.getTraces({ limit, offset: 0, filters }) as Array<
                    Record<string, unknown>
                >
                for (const t of traces) {
                    items.push({
                        id: t.id,
                        type: 'trace',
                        timestamp: t.timestamp,
                        title: t.span_name || t.model || 'LLM Request',
                        subtitle: t.service_name || t.provider,
                        model: t.model,
                        service_name: t.service_name,
                        tool: t.service_name,
                        status: t.status,
                        duration_ms: t.duration_ms,
                        tokens: t.total_tokens,
                        cost: t.estimated_cost,
                        data: t,
                    })
                }
            }

            if (!type || type === 'log') {
                const logFilters: db.LogFilters = {}
                if (filters.service_name) logFilters.service_name = filters.service_name
                if (filters.q) logFilters.q = filters.q
                if (filters.date_from) logFilters.date_from = filters.date_from

                const logs = db.getLogs({ limit, offset: 0, filters: logFilters }) as Array<
                    Record<string, unknown>
                >
                for (const l of logs) {
                    items.push({
                        id: l.id,
                        type: 'log',
                        timestamp: l.timestamp,
                        title: l.event_name || (l.body as string)?.slice(0, 50) || 'Log',
                        subtitle: l.service_name,
                        service_name: l.service_name,
                        tool: l.service_name,
                        severity_text: l.severity_text,
                        data: l,
                    })
                }
            }

            // Sort by timestamp descending
            items.sort(
                (a, b) =>
                    (b as { timestamp: number }).timestamp - (a as { timestamp: number }).timestamp,
            )

            return Response.json(items.slice(0, limit))
        }

        // Logs list
        if (pathname === '/api/logs' && method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || '50')
            const offset = Number(url.searchParams.get('offset') || '0')

            const filters: db.LogFilters = {}
            if (url.searchParams.get('service_name'))
                filters.service_name = url.searchParams.get('service_name')!
            if (url.searchParams.get('event_name'))
                filters.event_name = url.searchParams.get('event_name')!
            if (url.searchParams.get('trace_id'))
                filters.trace_id = url.searchParams.get('trace_id')!
            if (url.searchParams.get('severity_min'))
                filters.severity_min = Number(url.searchParams.get('severity_min'))
            if (url.searchParams.get('q')) filters.q = url.searchParams.get('q')!

            const logs = db.getLogs({ limit, offset, filters })
            const total = db.getLogCount(filters)
            return Response.json({ logs, total })
        }

        // Logs filters
        if (pathname === '/api/logs/filters' && method === 'GET') {
            return Response.json({
                services: db.getDistinctLogServices(),
                event_names: db.getDistinctEventNames(),
            })
        }

        // Single log
        if (pathname.match(/^\/api\/logs\/[^/]+$/) && method === 'GET') {
            const id = pathname.split('/').pop()!
            const logRecord = db.getLogById(id)

            if (!logRecord) {
                return Response.json({ error: 'Log not found' }, { status: 404 })
            }

            return Response.json(logRecord)
        }

        // Metrics list (or summary with aggregation param)
        if (pathname === '/api/metrics' && method === 'GET') {
            const filters: db.MetricFilters = {}
            if (url.searchParams.get('name')) filters.name = url.searchParams.get('name')!
            if (url.searchParams.get('service_name'))
                filters.service_name = url.searchParams.get('service_name')!
            if (url.searchParams.get('metric_type'))
                filters.metric_type = url.searchParams.get('metric_type')!

            if (url.searchParams.get('aggregation') === 'summary') {
                return Response.json({ summary: db.getMetricsSummary(filters) })
            }
            const limit = Number(url.searchParams.get('limit') || '50')
            const offset = Number(url.searchParams.get('offset') || '0')

            const metrics = db.getMetrics({ limit, offset, filters })
            const total = db.getMetricCount(filters)
            return Response.json({ metrics, total })
        }

        // Token usage from metrics
        if (pathname === '/api/metrics/tokens' && method === 'GET') {
            const usage = db.getTokenUsage()
            return Response.json({ usage })
        }

        // Single metric by ID
        if (
            pathname.match(/^\/api\/metrics\/[^/]+$/) &&
            method === 'GET' &&
            !pathname.includes('/filters') &&
            !pathname.includes('/summary') &&
            !pathname.includes('/tokens')
        ) {
            const id = pathname.split('/').pop()!
            const metric = db.getMetricById(id)

            if (!metric) {
                return Response.json({ error: 'Metric not found' }, { status: 404 })
            }

            return Response.json(metric)
        }

        // Metrics filters
        if (pathname === '/api/metrics/filters' && method === 'GET') {
            return Response.json({
                names: db.getDistinctMetricNames(),
                services: db.getDistinctMetricServices(),
            })
        }

        // Token usage endpoint
        if (pathname === '/api/token-usage' && method === 'GET') {
            const usage = db.getTokenUsage()
            return Response.json(usage)
        }

        // Metrics summary
        if (pathname === '/api/metrics/summary' && method === 'GET') {
            const dateFrom = url.searchParams.get('date_from')
                ? Number(url.searchParams.get('date_from'))
                : undefined
            const dateTo = url.searchParams.get('date_to')
                ? Number(url.searchParams.get('date_to'))
                : undefined
            const summary = db.getMetricsSummary({ date_from: dateFrom, date_to: dateTo })
            return Response.json(summary)
        }

        // Analytics combined
        if (pathname === '/api/analytics' && method === 'GET') {
            const days = Number(url.searchParams.get('days') || '30')
            const daily = db.getDailyStats({ days })
            const byTool = sanitizeByTool(db.getCostByTool({ days }))
            const byModel = sanitizeByModel(db.getCostByModel({ days }))
            return Response.json({ daily, by_tool: byTool, by_model: byModel, days })
        }

        // Analytics individual endpoints
        if (pathname === '/api/analytics/daily' && method === 'GET') {
            const days = Number(url.searchParams.get('days') || '30')
            const daily = db.getDailyStats({ days })
            return Response.json({ daily, days })
        }

        if (pathname === '/api/analytics/cost-by-tool' && method === 'GET') {
            const days = Number(url.searchParams.get('days') || '30')
            const byTool = sanitizeByTool(db.getCostByTool({ days }))
            return Response.json({ by_tool: byTool, days })
        }

        if (pathname === '/api/analytics/cost-by-model' && method === 'GET') {
            const days = Number(url.searchParams.get('days') || '30')
            const byModel = sanitizeByModel(db.getCostByModel({ days }))
            return Response.json({ by_model: byModel, days })
        }

        if (pathname === '/api/analytics/token-trends' && method === 'GET') {
            const interval = url.searchParams.get('interval') || 'hour'
            const days = Number(url.searchParams.get('days') || '7')
            const trends = db.getTokenTrends({ interval, days })
            return Response.json({ trends, interval, days })
        }

        // Create span (for SDK/testing)
        if (pathname === '/api/spans' && method === 'POST') {
            const body = (await req.json()) as Record<string, unknown>

            const spanId = (body.id as string) || crypto.randomUUID()
            const startTime = (body.start_time as number) || Date.now()
            const duration =
                (body.duration_ms as number | undefined) ??
                (body.end_time ? (body.end_time as number) - startTime : null)

            db.insertTrace({
                id: spanId,
                timestamp: startTime,
                duration_ms: duration ?? undefined,
                provider: (body.provider as string) || undefined,
                model: (body.model as string) || undefined,
                prompt_tokens: (body.prompt_tokens as number) || 0,
                completion_tokens: (body.completion_tokens as number) || 0,
                total_tokens: (body.total_tokens as number) || 0,
                estimated_cost: (body.estimated_cost as number) || 0,
                status: (body.status as number) || 200,
                error: (body.error as string) || undefined,
                request_method: undefined,
                request_path: undefined,
                request_headers: {},
                request_body: {},
                response_status: (body.status as number) || 200,
                response_headers: {},
                response_body: {},
                tags: (body.tags as string[]) || [],
                trace_id: (body.trace_id as string) || spanId,
                parent_id: (body.parent_id as string) || undefined,
                span_type: (body.span_type as string) || 'custom',
                span_name: (body.span_name as string) || (body.span_type as string) || 'span',
                input: body.input,
                output: body.output,
                attributes: (body.attributes as Record<string, unknown>) || {},
                service_name: (body.service_name as string) || 'app',
                session_id: (body.session_id as string) || undefined,
                conversation_id: (body.conversation_id as string) || undefined,
                agent_name: (body.agent_name as string) || undefined,
            })

            return Response.json(
                { id: spanId, trace_id: (body.trace_id as string) || spanId },
                { status: 201 },
            )
        }

        return Response.json({ error: 'Not Found' }, { status: 404 })
    } catch (error) {
        log.error(`API error: ${(error as Error).message}`)
        return Response.json({ error: (error as Error).message }, { status: 500 })
    }
}

// OTLP route handler - processes OpenTelemetry data
async function handleOtlpRoute(req: Request, url: URL): Promise<Response> {
    const signals = {
        '/v1/traces': { signal: 'trace', process: processOtlpTraces, rejected: 'rejectedSpans' },
        '/v1/logs': { signal: 'logs', process: processOtlpLogs, rejected: 'rejectedLogRecords' },
        '/v1/metrics': {
            signal: 'metrics',
            process: processOtlpMetrics,
            rejected: 'rejectedDataPoints',
        },
    }
    const route = signals[url.pathname as keyof typeof signals]
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

export function startProxyServer() {
    return Bun.serve({
        hostname: PROXY_HOST,
        port: PROXY_PORT,
        idleTimeout: 0,

        async fetch(req) {
            const url = new URL(req.url)

            // Health check
            if (url.pathname === '/health') {
                return Response.json({
                    status: 'ok',
                    service: 'proxy',
                    port: PROXY_PORT,
                    idleTimeout: 0,
                    traces: db.getTraceCount(),
                    uptime: process.uptime(),
                    providers: registry.list().map((p: { name: string }) => p.name),
                })
            }

            // List available providers
            if (url.pathname === '/providers') {
                return Response.json({
                    providers: registry.list(),
                    passthrough: Object.keys(passthroughHandlers).map((name) => ({
                        name: passthroughHandlers[name].name,
                        displayName: passthroughHandlers[name].displayName,
                        prefix: `/passthrough/${name}/*`,
                    })),
                    usage: {
                        default: 'Use /v1/* for OpenAI (default provider)',
                        custom: 'Use /{provider}/v1/* for other providers (e.g., /ollama/v1/chat/completions)',
                        header: 'Or set X-LLMFlow-Provider header to override',
                        passthrough:
                            'Use /passthrough/{provider}/* for native API formats (e.g., /passthrough/anthropic/v1/messages)',
                    },
                })
            }

            // CORS preflight
            if (req.method === 'OPTIONS') {
                return new Response(null, {
                    status: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': '*',
                        'Access-Control-Allow-Methods': '*',
                    },
                })
            }

            // Passthrough routes
            if (url.pathname.startsWith('/passthrough/anthropic/')) {
                return forwardProxyRequest(req, url, {
                    handler: passthroughHandlers.anthropic,
                    prefix: '/passthrough/anthropic',
                })
            }

            if (url.pathname.startsWith('/passthrough/gemini/')) {
                return forwardProxyRequest(req, url, {
                    handler: passthroughHandlers.gemini,
                    prefix: '/passthrough/gemini',
                })
            }

            if (url.pathname.startsWith('/passthrough/openai/')) {
                return forwardProxyRequest(req, url, {
                    handler: passthroughHandlers.openai,
                    prefix: '/passthrough/openai',
                })
            }

            if (url.pathname.startsWith('/passthrough/helicone/')) {
                return forwardProxyRequest(req, url, {
                    handler: passthroughHandlers.helicone,
                    prefix: '/passthrough/helicone',
                })
            }

            // All other routes go to the proxy handler
            const response = await forwardProxyRequest(req, url)

            // Add CORS headers to response
            const corsHeaders = new Headers(response.headers)
            corsHeaders.set('Access-Control-Allow-Origin', '*')
            corsHeaders.set('Access-Control-Allow-Headers', '*')
            corsHeaders.set('Access-Control-Allow-Methods', '*')

            return new Response(response.body, {
                status: response.status,
                headers: corsHeaders,
            })
        },
    })
}

// Entry point. Imports of this module from tests or tooling will NOT start
// listeners — only direct execution (`bun run src/server.ts`) does.
function main() {
    const stopExport = EXPORT_ENABLED ? initExportHooks(db) : () => {}
    if (EXPORT_ENABLED) {
        log.info('OTLP export enabled')
    }

    const dashboard = startDashboardServer()
    const proxy = startProxyServer()

    let stopping = false
    const shutdown = async () => {
        if (stopping) process.exit(0)
        stopping = true
        const deadline = setTimeout(() => process.exit(0), 5000)
        try {
            await Promise.all([dashboard.stop(), proxy.stop(), flushAll()])
            await stopExport()
        } catch (error) {
            log.error('Shutdown flush failed', error)
        } finally {
            clearTimeout(deadline)
            process.exit(0)
        }
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    console.log(`[llmflow] Dashboard: ${dashboard.url}`)
    console.log(`[llmflow] Proxy:     ${proxy.url}`)
}

if (import.meta.main) {
    main()
}
