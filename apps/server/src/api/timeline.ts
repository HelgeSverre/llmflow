// Traces and logs merged into one newest-first feed.
import * as db from '@llmflow/db'
import type { Route } from './router'

type Row = Record<string, unknown>
type Item = { timestamp: number } & Row

// Log bodies are stored as JSON; 'null' means the record had no body.
function logTitle(log: Row) {
    const body = log.body
    const text =
        typeof body === 'string'
            ? body === 'null'
                ? ''
                : body
            : body == null
              ? ''
              : JSON.stringify(body)
    return text || log.event_name || 'No message captured'
}

export const timelineRoutes: Route[] = [
    [
        'GET',
        '/api/timeline',
        (_req, url) => {
            const limit = Number(url.searchParams.get('limit') || '100')
            const params = url.searchParams
            const service_name = params.get('service_name') || undefined
            const q = params.get('q') || undefined
            const date_from = params.get('date_from') ? Number(params.get('date_from')) : undefined
            const type = params.get('type') || ''
            const items: Item[] = []

            if (!type || type === 'trace') {
                const filters: db.TraceFilters = { service_name, q, date_from }
                for (const t of db.getTraces({ limit, offset: 0, filters }) as Row[])
                    items.push({
                        id: t.id,
                        type: 'trace',
                        timestamp: t.timestamp as number,
                        title: t.span_name || t.model || 'LLM Request',
                        subtitle: t.service_name || t.provider,
                        model: t.model,
                        service_name: t.service_name,
                        status: t.status,
                        duration_ms: t.duration_ms,
                        tokens: t.total_tokens,
                        cost: t.estimated_cost,
                        data: t,
                    })
            }

            if (!type || type === 'log') {
                const filters: db.LogFilters = { service_name, q, date_from }
                for (const l of db.getLogs({ limit, offset: 0, filters }) as Row[])
                    items.push({
                        id: l.id,
                        type: 'log',
                        timestamp: l.timestamp as number,
                        title: logTitle(l),
                        subtitle: l.body && l.body !== 'null' ? l.event_name : null,
                        service_name: l.service_name,
                        severity_text: l.severity_text,
                        data: l,
                    })
            }

            items.sort((a, b) => b.timestamp - a.timestamp)
            return Response.json(items.slice(0, limit))
        },
    ],
]
