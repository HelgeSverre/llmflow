// Health, headline stats, services, per-model summaries and the analytics view.
import * as db from '@llmflow/db'
import { getPricingStatus } from '@llmflow/pricing'
import { DEFAULT_SERVICE_NAME } from '@llmflow/shared/config'
import type { Route } from './router'

// The dashboard charts break on null labels.
const orUnknown = (rows: unknown[], keys: string[]) =>
    (rows as Record<string, unknown>[]).map((row) => ({
        ...row,
        ...Object.fromEntries(keys.map((key) => [key, row[key] || 'unknown'])),
    }))

const DAY_MS = 24 * 60 * 60 * 1000

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
        (_req, url) =>
            Response.json(
                db
                    .getModelAggregates({
                        from: Number(url.searchParams.get('date_from') || 0),
                        to: Number(url.searchParams.get('date_to') || Date.now()),
                    })
                    .map(({ provider: _provider, ...model }) => model),
            ),
    ],
    [
        'GET',
        '/api/analytics',
        (_req, url) => {
            const days = Number(url.searchParams.get('days') || '30')
            return Response.json({
                daily: db.getDailyStats({ days }),
                by_service: orUnknown(db.getCostByService({ days }), ['provider']).map((row) => ({
                    ...row,
                    service_name:
                        (row as { service_name?: string }).service_name || DEFAULT_SERVICE_NAME,
                })),
                by_model: orUnknown(
                    db
                        .getModelAggregates({ from: Date.now() - days * DAY_MS, orderBy: 'cost' })
                        .map(({ avg_duration_ms: _latency, ...model }) => model),
                    ['model', 'provider'],
                ),
                days,
            })
        },
    ],
]
