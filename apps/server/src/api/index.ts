// Dashboard JSON API: one route table, handlers grouped by resource.
import { log } from '@llmflow/shared/logger'
import { logRoutes } from './logs'
import { metricRoutes } from './metrics'
import { overviewRoutes } from './overview'
import { match, type Route } from './router'
import { sessionRoutes } from './sessions'
import { timelineRoutes } from './timeline'
import { spanRoutes } from './spans'

const routes: Route[] = [
    ...overviewRoutes,
    ...spanRoutes,
    ...sessionRoutes,
    ...timelineRoutes,
    ...logRoutes,
    ...metricRoutes,
]

export async function handleApiRoute(req: Request, url: URL): Promise<Response> {
    const route = match(routes, req.method, url.pathname)
    if (!route) return Response.json({ error: 'Not Found' }, { status: 404 })
    try {
        return await route.handler(req, url, route.params)
    } catch (error) {
        log.error(`API error: ${(error as Error).message}`)
        return Response.json({ error: (error as Error).message }, { status: 500 })
    }
}
