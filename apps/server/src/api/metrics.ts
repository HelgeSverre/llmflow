import * as db from '@llmflow/db'
import { notFound, page, queryFilters, type Route } from './router'

// Exact paths come before the /api/metrics/:id pattern.
export const metricRoutes: Route[] = [
    [
        'GET',
        '/api/metrics',
        (_req, url) => {
            const filters = queryFilters<db.MetricFilters>(url, {
                name: 'text',
                service_name: 'text',
                metric_type: 'text',
            })
            if (url.searchParams.get('aggregation') === 'summary')
                return Response.json({ summary: db.getMetricsSummary(filters) })
            return Response.json({
                metrics: db.getMetrics({ ...page(url), filters }),
                total: db.getMetricCount(filters),
            })
        },
    ],
    ['GET', '/api/metrics/tokens', () => Response.json({ usage: db.getTokenUsage() })],
    [
        'GET',
        '/api/metrics/filters',
        () =>
            Response.json({
                names: db.getDistinctMetricNames(),
                services: db.getDistinctMetricServices(),
            }),
    ],
    [
        'GET',
        /^\/api\/metrics\/([^/]+)$/,
        (_req, _url, [id]) => {
            const metric = db.getMetricById(id!)
            return metric ? Response.json(metric) : notFound('Metric')
        },
    ],
]
