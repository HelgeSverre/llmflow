import * as db from '@llmflow/db'
import { notFound, page, type Route } from './router'

type Totals = { cost: number; tokens: number; spans: number; errors: number }

export const sessionRoutes: Route[] = [
    [
        'GET',
        '/api/sessions',
        (_req, url) => {
            const q = url.searchParams.get('q') || ''
            return Response.json({
                sessions: db.getSessions({ ...page(url), q }),
                total: db.getSessionCount(q),
            })
        },
    ],
    [
        'GET',
        /^\/api\/sessions\/([^/]+)$/,
        (_req, _url, [id]) => {
            const traces = db.getSessionTraces(id!) as Record<string, unknown>[]
            if (!traces.length) return notFound('Session')
            const summary = traces.reduce<Totals>(
                (acc, t) => ({
                    cost: acc.cost + ((t.cost as number) || 0),
                    tokens: acc.tokens + ((t.tokens as number) || 0),
                    spans: acc.spans + ((t.span_count as number) || 0),
                    errors: acc.errors + ((t.has_error as number) || 0),
                }),
                { cost: 0, tokens: 0, spans: 0, errors: 0 },
            )
            return Response.json({ session_id: id, traces, summary })
        },
    ],
]
