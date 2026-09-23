import * as db from '@llmflow/db'
import { notFound, page, queryFilters, type Route } from './router'

export const logRoutes: Route[] = [
    [
        'GET',
        '/api/logs',
        (_req, url) => {
            const filters = queryFilters<db.LogFilters>(url, {
                service_name: 'text',
                event_name: 'text',
                trace_id: 'text',
                severity_min: 'number',
                q: 'text',
            })
            return Response.json({
                logs: db.getLogs({ ...page(url), filters }),
                total: db.getLogCount(filters),
            })
        },
    ],
    [
        'GET',
        '/api/logs/filters',
        () =>
            Response.json({
                services: db.getDistinctLogServices(),
                event_names: db.getDistinctEventNames(),
            }),
    ],
    [
        'GET',
        /^\/api\/logs\/([^/]+)$/,
        (_req, _url, [id]) => {
            const record = db.getLogById(id!)
            return record ? Response.json(record) : notFound('Log')
        },
    ],
]
