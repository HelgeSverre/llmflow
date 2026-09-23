// Spans: list, detail, the tree of the trace a span belongs to, replay, and creation (SDK).
import * as db from '@llmflow/db'
import { parseTraceRow } from '@llmflow/db'
import { DEFAULT_SERVICE_NAME } from '@llmflow/shared/config'
import { log } from '@llmflow/shared/logger'
import { replayTrace, replayUnavailableReason } from '../replay'
import { notFound, page, queryFilters, type Route } from './router'

type Row = Record<string, unknown>
type TreeSpan = Row & { children: TreeSpan[] }

function traceDetail(row: Row) {
    const t = parseTraceRow(row)
    return {
        trace: {
            id: t.id,
            trace_id: t.trace_id,
            session_id: t.session_id,
            span_name: t.span_name,
            span_type: t.span_type,
            service_name: t.service_name,
            input: t.input,
            output: t.output,
            attributes: t.attributes,
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
            headers: t.request_headers,
            body: t.request_body,
        },
        response: {
            status: t.response_status,
            headers: t.response_headers,
            body: t.response_body,
        },
    }
}

function traceTree(id: string) {
    const root = db.getSpanById(id) as Row | null
    if (!root) return notFound('Span')
    const traceId = (root.trace_id as string) || id
    const spans = db.getSpansByTraceId(traceId) as Row[]

    const parsed: TreeSpan[] = spans.map((s) => ({
        ...parseTraceRow(s),
        replay_unavailable_reason: replayUnavailableReason(s),
        children: [],
    }))
    const byId = new Map(parsed.map((span) => [span.id as string, span]))
    const roots: TreeSpan[] = []
    for (const span of parsed) {
        const parent = span.parent_id ? byId.get(span.parent_id as string) : undefined
        if (parent) parent.children.push(span)
        else roots.push(span)
    }

    const missingParents = spans
        .filter((span) => span.parent_id && !byId.has(span.parent_id as string))
        .map((span) => span.parent_id)
    const start = Math.min(...spans.map((s) => s.timestamp as number))
    const end = spans.every((s) => s.duration_ms != null)
        ? Math.max(...spans.map((s) => (s.timestamp as number) + (s.duration_ms as number)))
        : null
    return Response.json({
        trace: {
            trace_id: traceId,
            partial: missingParents.length > 0 || db.wasTraceEvicted(traceId),
            missing_parent_ids: missingParents,
            start_time: start,
            end_time: end,
            duration_ms: end == null ? null : end - start,
            total_cost: spans.reduce((sum, s) => sum + ((s.estimated_cost as number) || 0), 0),
            total_tokens: spans.reduce((sum, s) => sum + ((s.total_tokens as number) || 0), 0),
            span_count: spans.length,
        },
        spans: roots,
    })
}

async function createSpan(req: Request) {
    const body = (await req.json()) as Row
    const id = (body.id as string) || crypto.randomUUID()
    const startTime = (body.start_time as number) || Date.now()
    const duration =
        (body.duration_ms as number | undefined) ??
        (body.end_time ? (body.end_time as number) - startTime : null)
    const traceId = (body.trace_id as string) || id
    db.insertSpan({
        id,
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
        trace_id: traceId,
        parent_id: (body.parent_id as string) || undefined,
        span_type: (body.span_type as string) || 'custom',
        span_name: (body.span_name as string) || (body.span_type as string) || 'span',
        input: body.input,
        output: body.output,
        attributes: (body.attributes as Record<string, unknown>) || {},
        service_name: (body.service_name as string) || DEFAULT_SERVICE_NAME,
        session_id: (body.session_id as string) || undefined,
        conversation_id: (body.conversation_id as string) || undefined,
        agent_name: (body.agent_name as string) || undefined,
    })
    return Response.json({ id, trace_id: traceId }, { status: 201 })
}

export const spanRoutes: Route[] = [
    [
        'GET',
        '/api/spans',
        (_req, url) => {
            const filters = queryFilters<db.SpanFilters>(url, {
                service_name: 'text',
                model: 'text',
                status: 'text',
                q: 'text',
                date_from: 'number',
                date_to: 'number',
                provider: 'text',
                trace_id: 'text',
                session_id: 'text',
                conversation_id: 'text',
            })
            return Response.json(db.getSpans({ ...page(url), filters }))
        },
    ],
    [
        'POST',
        /^\/api\/spans\/([^/]+)\/replay$/,
        async (req, _url, [id]) => {
            try {
                return await replayTrace(id!, req.signal)
            } catch (error) {
                log.error('Replay failed', error)
                return Response.json(
                    { error: 'Replay failed. Check the server log and provider configuration.' },
                    { status: 502 },
                )
            }
        },
    ],
    [
        'GET',
        /^\/api\/spans\/([^/]+)$/,
        (_req, _url, [id]) => {
            const trace = db.getSpanById(id!) as Row | null
            return trace ? Response.json(traceDetail(trace)) : notFound('Trace')
        },
    ],
    ['GET', /^\/api\/spans\/([^/]+)\/tree$/, (_req, _url, [id]) => traceTree(id!)],
    ['POST', '/api/spans', (req) => createSpan(req)],
]
