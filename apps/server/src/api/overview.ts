// Health, headline stats, services, per-model summaries and the analytics view.
import * as db from '@llmflow/db'
import { getPricingStatus } from '@llmflow/pricing'
import type { Route } from './router'

type ModelStats = {
    model: string
    count: number
    tokens: number
    prompt_tokens: number
    completion_tokens: number
    avg_latency: number
    cost: number
}

// The dashboard charts break on null labels.
const orUnknown = (rows: unknown[], keys: string[]) =>
    (rows as Record<string, unknown>[]).map((row) => ({
        ...row,
        ...Object.fromEntries(keys.map((key) => [key, row[key] || 'unknown'])),
    }))

export const overviewRoutes: Route[] = [
    [
        'GET',
        '/api/health',
        () => Response.json({ status: 'ok', timestamp: Date.now(), pricing: getPricingStatus() }),
    ],
    ['GET', '/api/stats', () => Response.json(db.getStats())],
    ['GET', '/api/services', () => Response.json(db.getServices())],
    [
        'GET',
        '/api/models',
        (_req, url) => {
            const models = db.getModelStats(
                Number(url.searchParams.get('date_from') || 0),
                Number(url.searchParams.get('date_to') || Date.now()),
            ) as ModelStats[]
            return Response.json(
                (models || []).map((m) => ({
                    model: m.model,
                    request_count: m.count || 0,
                    total_tokens: m.tokens || 0,
                    prompt_tokens: m.prompt_tokens ?? 0,
                    completion_tokens: m.completion_tokens ?? 0,
                    total_cost: m.cost || 0,
                    avg_latency: m.avg_latency ?? null,
                })),
            )
        },
    ],
    [
        'GET',
        '/api/analytics',
        (_req, url) => {
            const days = Number(url.searchParams.get('days') || '30')
            return Response.json({
                daily: db.getDailyStats({ days }),
                by_tool: orUnknown(db.getCostByTool({ days }), ['provider', 'service_name']),
                by_model: orUnknown(db.getCostByModel({ days }), ['model', 'provider']),
                days,
            })
        },
    ],
]
