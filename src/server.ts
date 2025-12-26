import * as db from './db'
import path from 'path'
import fs from 'fs'

// CommonJS imports
const { calculateCost } = require('../pricing')
const log = require('../logger')
const { registry } = require('../providers')
const { AnthropicPassthrough, GeminiPassthrough, OpenAIPassthrough, HeliconePassthrough } = require('../providers/passthrough')
const { processOtlpTraces } = require('../otlp')
const { processOtlpLogs } = require('../otlp-logs')
const { processOtlpMetrics } = require('../otlp-metrics')

// Passthrough handlers for native API formats
const passthroughHandlers: Record<string, PassthroughHandler> = {
    anthropic: new AnthropicPassthrough(),
    gemini: new GeminiPassthrough(),
    openai: new OpenAIPassthrough(),
    helicone: new HeliconePassthrough()
}

// Provider interface for TypeScript
interface Provider {
    name: string
    displayName: string
    getTarget(req: ProxyRequest): { hostname: string; port: number; path: string; protocol: string }
    transformRequestHeaders(headers: Record<string, string>, req: ProxyRequest): Record<string, string>
    transformRequestBody(body: unknown, req: ProxyRequest): unknown
    normalizeResponse(body: unknown, req: ProxyRequest): { data: unknown; usage: TokenUsage | null; model: string }
    parseStreamChunk(chunk: string): { content: string; usage: TokenUsage | null; done: boolean }
    assembleStreamingResponse(content: string, usage: TokenUsage | null, req: ProxyRequest, traceId: string): unknown
    extractUsage(response: unknown): TokenUsage
    isStreamingRequest(req: ProxyRequest): boolean
    getHttpModule(): unknown
}

interface PassthroughHandler {
    name: string
    displayName: string
    getTarget(req: ProxyRequest): { hostname: string; port: number; path: string; protocol: string }
    defaultHeaderTransform(headers: Record<string, string>): Record<string, string>
    defaultExtractUsage(body: unknown): TokenUsage
    defaultIdentifyModel(reqBody: unknown, respBody: unknown): string
    defaultParseStreamChunk(chunk: string): { content: string; usage: TokenUsage | null; done: boolean }
    isStreamingRequest(req: ProxyRequest): boolean
    sanitizeHeaders(headers: Record<string, string>): Record<string, string>
}

interface ProxyRequest {
    method: string
    path: string
    headers: Record<string, string>
    body: unknown
}

interface TokenUsage {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
}

const PROXY_PORT = Number(process.env.PROXY_PORT || 8080)
const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT || 3000)

// Types
interface TraceData {
    model?: string
    usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
    }
    status?: number
    headers?: Record<string, string>
    data?: unknown
}

// Helper functions
function extractTagsFromHeaders(headers: Headers): string[] {
    const tags: string[] = []
    const tagHeader = headers.get('x-llmflow-tag') || headers.get('x-llmflow-tags')

    if (!tagHeader) return tags

    const parts = tagHeader.split(',').map(t => t.trim()).filter(Boolean)
    tags.push(...parts)

    return tags
}

function logInteraction(
    traceId: string,
    method: string,
    urlPath: string,
    headers: Headers,
    requestBody: unknown,
    responseData: TraceData,
    duration: number,
    error: string | null = null,
    providerName = 'openai'
) {
    try {
        const timestamp = Date.now()
        const usage = responseData?.usage || {}
        const model = responseData?.model || (requestBody as Record<string, unknown>)?.model as string || 'unknown'

        const promptTokens = usage.prompt_tokens || 0
        const completionTokens = usage.completion_tokens || 0
        const totalTokens = usage.total_tokens || promptTokens + completionTokens
        const estimatedCost = calculateCost(model, promptTokens, completionTokens)
        const status = responseData?.status || (error ? 500 : 200)

        const customTags = extractTagsFromHeaders(headers)

        db.insertTrace({
            id: traceId,
            timestamp,
            duration_ms: duration,
            provider: providerName,
            model,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            estimated_cost: estimatedCost,
            status,
            error: error || undefined,
            request_method: method,
            request_path: urlPath,
            request_headers: Object.fromEntries(headers.entries()),
            request_body: requestBody,
            response_status: status,
            response_headers: responseData?.headers || {},
            response_body: responseData?.data || { error },
            tags: customTags,
            trace_id: headers.get('x-trace-id') || traceId,
            parent_id: headers.get('x-parent-id') || undefined
        })
    } catch (err) {
        log.error(`Failed to log: ${(err as Error).message}`)
    }
}

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
db.setInsertTraceHook((trace: db.TraceSummary) => {
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

db.setInsertLogHook((log: db.LogSummary) => {
    broadcast({ type: 'new_log', payload: log })
    
    // If log has trace_id, notify trace subscribers
    if (log.trace_id) {
        broadcast({ 
            type: 'trace_log_added', 
            payload: { trace_id: log.trace_id, log }
        })
    }
})

db.setInsertMetricHook((metric: db.MetricSummary) => {
    broadcast({ type: 'new_metric', payload: metric })
})

// Static file serving
const publicDir = path.join(import.meta.dir, '..', 'public')

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
        '.ico': 'image/x-icon'
    }
    return mimeTypes[ext] || 'application/octet-stream'
}

// Dashboard server
export const dashboardServer = Bun.serve({
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
        }
    },
    
    async fetch(req, server) {
        const url = new URL(req.url)
        const pathname = url.pathname
        
        // WebSocket upgrade
        if (pathname === '/ws') {
            if (server.upgrade(req)) return new Response(null)
            return new Response('WebSocket upgrade failed', { status: 400 })
        }
        
        // API routes
        if (pathname.startsWith('/api/')) {
            return handleApiRoute(req, url)
        }
        
        // OTLP routes
        if (pathname.startsWith('/v1/traces') || pathname.startsWith('/v1/logs') || pathname.startsWith('/v1/metrics')) {
            return handleOtlpRoute(req, url)
        }
        
        // Static files
        if (pathname === '/' || pathname === '/index.html') {
            return serveStaticFile('index.html')
        }
        
        return serveStaticFile(pathname)
    }
})

// Sanitize analytics data to ensure no null values that break frontend
function sanitizeByTool(data: unknown[]): unknown[] {
    return (data as Record<string, unknown>[]).map(item => ({
        ...item,
        provider: item.provider || 'unknown',
        service_name: item.service_name || 'unknown'
    }))
}

function sanitizeByModel(data: unknown[]): unknown[] {
    return (data as Record<string, unknown>[]).map(item => ({
        ...item,
        model: item.model || 'unknown',
        provider: item.provider || 'unknown'
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
    
    const checkProvider = async (name: string, checkFn: () => Promise<{ ok: boolean; message?: string }>): Promise<HealthResult> => {
        try {
            const start = Date.now()
            const result = await checkFn()
            return {
                status: result.ok ? 'ok' : 'error',
                latency_ms: Date.now() - start,
                message: result.message || undefined
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
                    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
                    signal: controller.signal
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
                        'Content-Type': 'application/json'
                    },
                    body: '{}',
                    signal: controller.signal
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
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, {
                    signal: controller.signal
                })
                clearTimeout(timeout)
                return { ok: res.status === 200 }
            } catch (e) {
                return { ok: false, message: (e as Error).message }
            }
        })
    } else {
        results.gemini = { status: 'unconfigured', message: 'GOOGLE_API_KEY/GEMINI_API_KEY not set' }
    }
    
    // Check Groq
    if (process.env.GROQ_API_KEY) {
        results.groq = await checkProvider('groq', async () => {
            try {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 5000)
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
                    signal: controller.signal
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
                signal: controller.signal
            })
            clearTimeout(timeout)
            return { ok: res.status === 200 }
        } catch {
            return { ok: false, message: `not reachable at ${ollamaHost}:${ollamaPort}` }
        }
    })
    
    const okCount = Object.values(results).filter(r => r.status === 'ok').length
    const totalConfigured = Object.values(results).filter(r => r.status !== 'unconfigured').length
    
    return Response.json({
        summary: `${okCount}/${totalConfigured} providers healthy`,
        providers: results
    })
}

// API route handler
async function handleApiRoute(req: Request, url: URL): Promise<Response> {
    const pathname = url.pathname
    const method = req.method
    
    try {
        // Health check
        if (pathname === '/api/health' && method === 'GET') {
            return Response.json({ status: 'ok', timestamp: Date.now() })
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
            const models = ((stats.models || []) as Array<{ model: string; count: number; tokens: number; cost: number }>).map(m => ({
                model: m.model,
                request_count: m.count || 0,
                total_tokens: m.tokens || 0,
                prompt_tokens: Math.round((m.tokens || 0) * 0.7),
                completion_tokens: Math.round((m.tokens || 0) * 0.3),
                total_cost: m.cost || 0,
                avg_latency: 0
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
            if (url.searchParams.get('date_from')) filters.date_from = Number(url.searchParams.get('date_from'))
            if (url.searchParams.get('date_to')) filters.date_to = Number(url.searchParams.get('date_to'))
            if (url.searchParams.get('provider')) filters.provider = url.searchParams.get('provider')!
            
            const traces = db.getTraces({ limit, offset, filters })
            return Response.json(traces)
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
                    timestamp: t.timestamp,
                    duration_ms: t.duration_ms,
                    model: t.model,
                    prompt_tokens: t.prompt_tokens,
                    completion_tokens: t.completion_tokens,
                    total_tokens: t.total_tokens,
                    status: t.status,
                    error: t.error,
                    estimated_cost: t.estimated_cost
                },
                request: {
                    method: t.request_method,
                    path: t.request_path,
                    headers: JSON.parse(t.request_headers as string || '{}'),
                    body: JSON.parse(t.request_body as string || '{}')
                },
                response: {
                    status: t.response_status,
                    headers: JSON.parse(t.response_headers as string || '{}'),
                    body: JSON.parse(t.response_body as string || '{}')
                }
            })
        }
        
        // Trace tree (spans)
        if (pathname.match(/^\/api\/traces\/[^/]+\/tree$/) && method === 'GET') {
            const id = pathname.split('/')[3]
            
            const rootSpan = db.getTraceById(id)
            if (!rootSpan) {
                return Response.json({ error: 'Span not found' }, { status: 404 })
            }
            
            const traceId = (rootSpan as Record<string, unknown>).trace_id as string || id
            const spans = db.getSpansByTraceId(traceId) as Record<string, unknown>[]
            
            // Parse JSON fields and add children array
            const parsedSpans = spans.map(s => ({
                ...s,
                request_headers: JSON.parse(s.request_headers as string || '{}'),
                request_body: JSON.parse(s.request_body as string || '{}'),
                response_headers: JSON.parse(s.response_headers as string || '{}'),
                response_body: JSON.parse(s.response_body as string || '{}'),
                input: JSON.parse(s.input as string || 'null'),
                output: JSON.parse(s.output as string || 'null'),
                attributes: JSON.parse(s.attributes as string || '{}'),
                tags: JSON.parse(s.tags as string || '[]'),
                children: [] as Record<string, unknown>[]
            }))
            
            // Build tree
            const byId = new Map<string, typeof parsedSpans[0]>()
            parsedSpans.forEach(s => byId.set(s.id as string, s))
            const roots: typeof parsedSpans = []
            
            for (const span of parsedSpans) {
                if (span.parent_id && byId.has(span.parent_id as string)) {
                    byId.get(span.parent_id as string)!.children.push(span)
                } else {
                    roots.push(span)
                }
            }
            
            // Aggregate stats
            const totalCost = spans.reduce((acc, s) => acc + ((s.estimated_cost as number) || 0), 0)
            const totalTokens = spans.reduce((acc, s) => acc + ((s.total_tokens as number) || 0), 0)
            const startTs = Math.min(...spans.map(s => (s.timestamp as number) || Infinity))
            const endTs = Math.max(...spans.map(s => ((s.timestamp as number) || 0) + ((s.duration_ms as number) || 0)))
            
            return Response.json({
                trace: {
                    trace_id: traceId,
                    start_time: startTs,
                    end_time: endTs,
                    duration_ms: endTs - startTs,
                    total_cost: totalCost,
                    total_tokens: totalTokens,
                    span_count: spans.length
                },
                spans: roots
            })
        }
        
        // Timeline
        if (pathname === '/api/timeline' && method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || '100')
            const filters: db.TraceFilters = {}
            if (url.searchParams.get('q')) filters.q = url.searchParams.get('q')!
            if (url.searchParams.get('tool')) filters.service_name = url.searchParams.get('tool')!
            if (url.searchParams.get('date_from')) filters.date_from = Number(url.searchParams.get('date_from'))
            
            const type = url.searchParams.get('type') || ''
            const items: unknown[] = []
            
            if (!type || type === 'trace') {
                const traces = db.getTraces({ limit, offset: 0, filters }) as Array<Record<string, unknown>>
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
                        data: t
                    })
                }
            }
            
            if (!type || type === 'log') {
                const logFilters: db.LogFilters = {}
                if (filters.service_name) logFilters.service_name = filters.service_name
                if (filters.q) logFilters.q = filters.q
                if (filters.date_from) logFilters.date_from = filters.date_from
                
                const logs = db.getLogs({ limit, offset: 0, filters: logFilters }) as Array<Record<string, unknown>>
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
                        data: l
                    })
                }
            }
            
            // Sort by timestamp descending
            items.sort((a, b) => (b as { timestamp: number }).timestamp - (a as { timestamp: number }).timestamp)
            
            return Response.json(items.slice(0, limit))
        }
        
        // Logs list
        if (pathname === '/api/logs' && method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || '50')
            const offset = Number(url.searchParams.get('offset') || '0')
            
            const filters: db.LogFilters = {}
            if (url.searchParams.get('service_name')) filters.service_name = url.searchParams.get('service_name')!
            if (url.searchParams.get('event_name')) filters.event_name = url.searchParams.get('event_name')!
            if (url.searchParams.get('trace_id')) filters.trace_id = url.searchParams.get('trace_id')!
            if (url.searchParams.get('severity_min')) filters.severity_min = Number(url.searchParams.get('severity_min'))
            if (url.searchParams.get('q')) filters.q = url.searchParams.get('q')!
            
            const logs = db.getLogs({ limit, offset, filters })
            const total = db.getLogCount(filters)
            return Response.json({ logs, total })
        }
        
        // Logs filters
        if (pathname === '/api/logs/filters' && method === 'GET') {
            return Response.json({
                services: db.getDistinctLogServices(),
                event_names: db.getDistinctEventNames()
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
            // Handle aggregation=summary query param
            if (url.searchParams.get('aggregation') === 'summary') {
                const summary = db.getMetricsSummary({})
                return Response.json({ summary })
            }
            
            const limit = Number(url.searchParams.get('limit') || '50')
            const offset = Number(url.searchParams.get('offset') || '0')
            
            const filters: db.MetricFilters = {}
            if (url.searchParams.get('name')) filters.name = url.searchParams.get('name')!
            if (url.searchParams.get('service_name')) filters.service_name = url.searchParams.get('service_name')!
            if (url.searchParams.get('metric_type')) filters.metric_type = url.searchParams.get('metric_type')!
            
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
        if (pathname.match(/^\/api\/metrics\/[^/]+$/) && method === 'GET' && !pathname.includes('/filters') && !pathname.includes('/summary') && !pathname.includes('/tokens')) {
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
                services: db.getDistinctMetricServices()
            })
        }
        
        // Token usage endpoint
        if (pathname === '/api/token-usage' && method === 'GET') {
            const usage = db.getTokenUsage()
            return Response.json(usage)
        }
        
        // Metrics summary
        if (pathname === '/api/metrics/summary' && method === 'GET') {
            const dateFrom = url.searchParams.get('date_from') ? Number(url.searchParams.get('date_from')) : undefined
            const dateTo = url.searchParams.get('date_to') ? Number(url.searchParams.get('date_to')) : undefined
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
            const body = await req.json() as Record<string, unknown>
            
            const spanId = (body.id as string) || crypto.randomUUID()
            const startTime = (body.start_time as number) || Date.now()
            const duration = (body.duration_ms as number) || (body.end_time ? (body.end_time as number) - startTime : null)
            
            db.insertTrace({
                id: spanId,
                timestamp: startTime,
                duration_ms: duration || undefined,
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
                service_name: (body.service_name as string) || 'app'
            })
            
            return Response.json({ id: spanId, trace_id: (body.trace_id as string) || spanId }, { status: 201 })
        }
        
        return Response.json({ error: 'Not Found' }, { status: 404 })
        
    } catch (error) {
        log.error(`API error: ${(error as Error).message}`)
        return Response.json({ error: (error as Error).message }, { status: 500 })
    }
}

// OTLP route handler - processes OpenTelemetry data
async function handleOtlpRoute(req: Request, url: URL): Promise<Response> {
    const pathname = url.pathname
    
    try {
        const body = await req.json()
        
        if (pathname === '/v1/traces' && req.method === 'POST') {
            const results = processOtlpTraces(body)
            return Response.json({
                partialSuccess: results.rejected > 0 ? {
                    rejectedSpans: results.rejected,
                    errorMessage: results.errors.slice(0, 5).join('; ')
                } : undefined
            })
        }
        
        if (pathname === '/v1/logs' && req.method === 'POST') {
            const results = processOtlpLogs(body)
            return Response.json({
                partialSuccess: results.rejected > 0 ? {
                    rejectedLogRecords: results.rejected,
                    errorMessage: results.errors.slice(0, 5).join('; ')
                } : undefined
            })
        }
        
        if (pathname === '/v1/metrics' && req.method === 'POST') {
            const results = processOtlpMetrics(body)
            return Response.json({
                partialSuccess: results.rejected > 0 ? {
                    rejectedDataPoints: results.rejected,
                    errorMessage: results.errors.slice(0, 5).join('; ')
                } : undefined
            })
        }
        
        return Response.json({ error: 'Not Found' }, { status: 404 })
    } catch (error) {
        log.error(`OTLP error: ${(error as Error).message}`)
        return Response.json({ error: (error as Error).message }, { status: 500 })
    }
}

// Proxy handler using fetch()
async function handleProxyRequest(req: Request, url: URL): Promise<Response> {
    const startTime = Date.now()
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID()
    
    // Parse request body if present
    let body: unknown = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
            body = await req.json()
        } catch {
            body = null
        }
    }
    
    // Build proxy request object for provider compatibility
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
        headers[key] = value
    })
    
    const proxyReq: ProxyRequest = {
        method: req.method,
        path: url.pathname,
        headers,
        body
    }
    
    // Resolve provider based on path or header
    const { provider, cleanPath } = registry.resolve(proxyReq) as { provider: Provider; cleanPath: string }
    proxyReq.path = cleanPath
    
    const isStreaming = provider.isStreamingRequest(proxyReq)
    
    log.request(req.method, url.pathname, traceId)
    log.debug(`Provider: ${provider.name}, Model: ${(body as Record<string, unknown>)?.model || 'N/A'}, Stream: ${isStreaming}`)
    
    try {
        // Transform request for this provider
        const transformedBody = provider.transformRequestBody(body, proxyReq)
        const transformedHeaders = provider.transformRequestHeaders(headers, proxyReq)
        const target = provider.getTarget(proxyReq)
        
        // Build upstream URL
        const protocol = target.protocol || 'https'
        const upstreamUrl = `${protocol}://${target.hostname}${target.port !== 443 && target.port !== 80 ? ':' + target.port : ''}${target.path}`
        
        // Make fetch request
        const fetchOptions: RequestInit = {
            method: req.method,
            headers: transformedHeaders
        }
        
        if (req.method !== 'GET' && req.method !== 'HEAD' && transformedBody) {
            fetchOptions.body = JSON.stringify(transformedBody)
        }
        
        const upstreamRes = await fetch(upstreamUrl, fetchOptions)
        
        if (!isStreaming) {
            // Non-streaming: buffer entire response
            const duration = Date.now() - startTime
            let rawResponse: unknown
            
            try {
                rawResponse = await upstreamRes.json()
            } catch {
                const text = await upstreamRes.text()
                rawResponse = { error: 'Invalid JSON response', body: text }
            }
            
            // Normalize response through provider
            const normalized = provider.normalizeResponse(rawResponse, proxyReq)
            const usage = provider.extractUsage(normalized.data)
            const cost = calculateCost(normalized.model, usage.prompt_tokens, usage.completion_tokens)
            
            log.proxy({
                provider: provider.name,
                model: normalized.model,
                tokens: usage.total_tokens,
                cost,
                duration,
                streaming: false
            })
            
            // Log to database
            const respHeaders: Record<string, string> = {}
            upstreamRes.headers.forEach((value, key) => {
                respHeaders[key] = value
            })
            
            logInteraction(
                traceId,
                req.method,
                url.pathname,
                req.headers,
                body,
                {
                    status: upstreamRes.status,
                    headers: respHeaders,
                    data: normalized.data,
                    usage,
                    model: normalized.model
                },
                duration,
                null,
                provider.name
            )
            
            return Response.json(normalized.data, { status: upstreamRes.status })
        } else {
            // Streaming: use tee() to split stream for client and logging
            if (!upstreamRes.body) {
                return new Response('No response body', { status: 502 })
            }
            
            const [clientStream, logStream] = upstreamRes.body.tee()
            
            // Process log stream asynchronously for usage extraction
            processStreamForLogging(logStream, provider, proxyReq, traceId, startTime, upstreamRes, body, req.method, url.pathname)
            
            // Forward response headers
            const responseHeaders = new Headers()
            upstreamRes.headers.forEach((value, key) => {
                responseHeaders.set(key, value)
            })
            
            return new Response(clientStream, {
                status: upstreamRes.status,
                headers: responseHeaders
            })
        }
    } catch (error) {
        const duration = Date.now() - startTime
        const errMessage = (error as Error).message
        log.proxy({ provider: provider.name, error: errMessage, duration })
        logInteraction(traceId, req.method, url.pathname, req.headers, body, { status: 500 }, duration, errMessage, provider.name)
        return Response.json({ error: 'Proxy request failed', message: errMessage, provider: provider.name }, { status: 500 })
    }
}

// Process stream for logging without blocking client response
async function processStreamForLogging(
    stream: ReadableStream<Uint8Array>,
    provider: Provider,
    proxyReq: ProxyRequest,
    traceId: string,
    startTime: number,
    upstreamRes: Response,
    body: unknown,
    method: string,
    pathname: string
) {
    try {
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        let streamBuffer = ''
        let chunkCount = 0
        
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunkCount++
            streamBuffer += decoder.decode(value, { stream: true })
        }
        
        const duration = Date.now() - startTime
        
        // Parse complete stream for usage extraction
        const parsed = provider.parseStreamChunk(streamBuffer)
        const fullContent = parsed.content || ''
        const finalUsage = parsed.usage
        
        const usage = finalUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        const model = (body as Record<string, unknown>)?.model as string || 'unknown'
        const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens)
        
        log.proxy({
            provider: provider.name,
            model,
            tokens: usage.total_tokens,
            cost,
            duration,
            streaming: true
        })
        
        log.debug(`Chunks: ${chunkCount}, Content: ${fullContent.length} chars`)
        
        const assembledResponse = provider.assembleStreamingResponse(fullContent, finalUsage, proxyReq, traceId) as Record<string, unknown>
        assembledResponse._chunks = chunkCount
        
        const respHeaders: Record<string, string> = {}
        upstreamRes.headers.forEach((value, key) => {
            respHeaders[key] = value
        })
        
        logInteraction(
            traceId,
            method,
            pathname,
            new Headers(),
            body,
            {
                status: upstreamRes.status,
                headers: respHeaders,
                data: assembledResponse,
                usage,
                model
            },
            duration,
            null,
            provider.name
        )
    } catch (err) {
        log.error(`Stream logging error: ${(err as Error).message}`)
    }
}

// Passthrough handler - forwards requests without body transformation
async function handlePassthroughRequest(req: Request, url: URL, handler: PassthroughHandler, basePath: string): Promise<Response> {
    const startTime = Date.now()
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID()
    
    // Parse request body if present
    let body: unknown = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
            body = await req.json()
        } catch {
            body = null
        }
    }
    
    // Build proxy request object
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
        headers[key] = value
    })
    
    // Remove base path for passthrough
    const cleanPath = url.pathname.replace(basePath, '')
    
    const proxyReq: ProxyRequest = {
        method: req.method,
        path: cleanPath,
        headers,
        body
    }
    
    const isStreaming = handler.isStreamingRequest(proxyReq)
    
    log.request(req.method, url.pathname, traceId)
    log.debug(`Passthrough: ${handler.name}, Model: ${(body as Record<string, unknown>)?.model || 'N/A'}, Stream: ${isStreaming}`)
    
    try {
        // Transform only headers, NOT body (passthrough mode)
        const transformedHeaders = handler.defaultHeaderTransform(headers)
        const target = handler.getTarget(proxyReq)
        
        // Build upstream URL
        const protocol = target.protocol || 'https'
        const upstreamUrl = `${protocol}://${target.hostname}${target.port !== 443 && target.port !== 80 ? ':' + target.port : ''}${target.path}`
        
        // Make fetch request with original body
        const fetchOptions: RequestInit = {
            method: req.method,
            headers: transformedHeaders
        }
        
        if (req.method !== 'GET' && req.method !== 'HEAD' && body) {
            fetchOptions.body = JSON.stringify(body)
        }
        
        const upstreamRes = await fetch(upstreamUrl, fetchOptions)
        
        if (!isStreaming) {
            // Non-streaming: forward response while extracting usage
            const responseText = await upstreamRes.text()
            const duration = Date.now() - startTime
            
            let parsedResponse: unknown = null
            try {
                parsedResponse = JSON.parse(responseText)
            } catch {
                parsedResponse = null
            }
            
            // Extract usage from native response format (for logging only)
            const usage = parsedResponse ? handler.defaultExtractUsage(parsedResponse) : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            const model = handler.defaultIdentifyModel(body, parsedResponse)
            const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens)
            
            log.proxy({
                provider: handler.name,
                model,
                tokens: usage.total_tokens,
                cost,
                duration,
                streaming: false,
                passthrough: true
            })
            
            const respHeaders: Record<string, string> = {}
            upstreamRes.headers.forEach((value, key) => {
                respHeaders[key] = value
            })
            
            logInteraction(
                traceId,
                req.method,
                url.pathname,
                req.headers,
                body,
                {
                    status: upstreamRes.status,
                    headers: respHeaders,
                    data: parsedResponse || { _raw: responseText.substring(0, 10000) },
                    usage,
                    model
                },
                duration,
                null,
                handler.name
            )
            
            // Forward response with original headers (passthrough)
            const responseHeaders = new Headers()
            upstreamRes.headers.forEach((value, key) => {
                if (key.toLowerCase() !== 'content-length' && key.toLowerCase() !== 'transfer-encoding') {
                    responseHeaders.set(key, value)
                }
            })
            
            return new Response(responseText, {
                status: upstreamRes.status,
                headers: responseHeaders
            })
        } else {
            // Streaming passthrough: use tee() for logging
            if (!upstreamRes.body) {
                return new Response('No response body', { status: 502 })
            }
            
            const [clientStream, logStream] = upstreamRes.body.tee()
            
            // Process log stream asynchronously
            processPassthroughStreamForLogging(logStream, handler, traceId, startTime, upstreamRes, body, req.method, url.pathname)
            
            // Forward response headers
            const responseHeaders = new Headers()
            upstreamRes.headers.forEach((value, key) => {
                responseHeaders.set(key, value)
            })
            
            return new Response(clientStream, {
                status: upstreamRes.status,
                headers: responseHeaders
            })
        }
    } catch (error) {
        const duration = Date.now() - startTime
        const errMessage = (error as Error).message
        log.proxy({ provider: handler.name, error: errMessage, duration, passthrough: true })
        logInteraction(traceId, req.method, url.pathname, req.headers, body, { status: 502 }, duration, errMessage, handler.name)
        return Response.json({ error: 'Passthrough failed', message: errMessage, provider: handler.name }, { status: 502 })
    }
}

// Process passthrough stream for logging
async function processPassthroughStreamForLogging(
    stream: ReadableStream<Uint8Array>,
    handler: PassthroughHandler,
    traceId: string,
    startTime: number,
    upstreamRes: Response,
    body: unknown,
    method: string,
    pathname: string
) {
    try {
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        let streamBuffer = ''
        let chunkCount = 0
        
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunkCount++
            streamBuffer += decoder.decode(value, { stream: true })
        }
        
        const duration = Date.now() - startTime
        const model = handler.defaultIdentifyModel(body, {})
        
        // Parse complete stream for usage extraction
        const parsed = handler.defaultParseStreamChunk(streamBuffer)
        const fullContent = parsed.content || ''
        const finalUsage = parsed.usage
        
        const usage = finalUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens)
        
        log.proxy({
            provider: handler.name,
            model,
            tokens: usage.total_tokens,
            cost,
            duration,
            streaming: true,
            passthrough: true
        })
        
        log.debug(`Passthrough chunks: ${chunkCount}, Content: ${fullContent.length} chars`)
        
        const assembledResponse = {
            id: traceId,
            model,
            content: fullContent,
            usage,
            _streaming: true,
            _chunks: chunkCount,
            _passthrough: true
        }
        
        const respHeaders: Record<string, string> = {}
        upstreamRes.headers.forEach((value, key) => {
            respHeaders[key] = value
        })
        
        logInteraction(
            traceId,
            method,
            pathname,
            new Headers(),
            body,
            {
                status: upstreamRes.status,
                headers: respHeaders,
                data: assembledResponse,
                usage,
                model
            },
            duration,
            null,
            handler.name
        )
    } catch (err) {
        log.error(`Passthrough stream logging error: ${(err as Error).message}`)
    }
}

// Proxy server
export const proxyServer = Bun.serve({
    port: PROXY_PORT,
    
    async fetch(req) {
        const url = new URL(req.url)
        
        // Health check
        if (url.pathname === '/health') {
            return Response.json({ 
                status: 'ok', 
                service: 'proxy',
                port: PROXY_PORT,
                traces: db.getTraceCount(),
                uptime: process.uptime(),
                providers: registry.list().map((p: { name: string }) => p.name)
            })
        }
        
        // List available providers
        if (url.pathname === '/providers') {
            return Response.json({
                providers: registry.list(),
                passthrough: Object.keys(passthroughHandlers).map(name => ({
                    name: passthroughHandlers[name].name,
                    displayName: passthroughHandlers[name].displayName,
                    prefix: `/passthrough/${name}/*`
                })),
                usage: {
                    default: 'Use /v1/* for OpenAI (default provider)',
                    custom: 'Use /{provider}/v1/* for other providers (e.g., /ollama/v1/chat/completions)',
                    header: 'Or set X-LLMFlow-Provider header to override',
                    passthrough: 'Use /passthrough/{provider}/* for native API formats (e.g., /passthrough/anthropic/v1/messages)'
                }
            })
        }
        
        // CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': '*'
                }
            })
        }
        
        // Passthrough routes
        if (url.pathname.startsWith('/passthrough/anthropic/')) {
            return handlePassthroughRequest(req, url, passthroughHandlers.anthropic, '/passthrough/anthropic')
        }
        
        if (url.pathname.startsWith('/passthrough/gemini/')) {
            return handlePassthroughRequest(req, url, passthroughHandlers.gemini, '/passthrough/gemini')
        }
        
        if (url.pathname.startsWith('/passthrough/openai/')) {
            return handlePassthroughRequest(req, url, passthroughHandlers.openai, '/passthrough/openai')
        }
        
        if (url.pathname.startsWith('/passthrough/helicone/')) {
            return handlePassthroughRequest(req, url, passthroughHandlers.helicone, '/passthrough/helicone')
        }
        
        // All other routes go to the proxy handler
        const response = await handleProxyRequest(req, url)
        
        // Add CORS headers to response
        const corsHeaders = new Headers(response.headers)
        corsHeaders.set('Access-Control-Allow-Origin', '*')
        corsHeaders.set('Access-Control-Allow-Headers', '*')
        corsHeaders.set('Access-Control-Allow-Methods', '*')
        
        return new Response(response.body, {
            status: response.status,
            headers: corsHeaders
        })
    }
})

console.log(`[llmflow] Dashboard: http://localhost:${DASHBOARD_PORT}`)
console.log(`[llmflow] Proxy:     http://localhost:${PROXY_PORT}`)
