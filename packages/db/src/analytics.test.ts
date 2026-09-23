import { afterAll, describe, expect, test } from 'bun:test'
import type { ModelAggregate } from './index'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// The database module opens DB_PATH on import, so point it at a temp directory
// first; these tests must never touch the developer's database.
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-analytics-'))
process.env.DATA_DIR = directory
process.env.DB_PATH = path.join(directory, 'test.db')
const db = await import('./index')

afterAll(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
})

type Row = Record<string, unknown>
const rows = (value: unknown) => value as Row[]

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const seed: [provider: string, model: string, cost: number, age: number][] = [
    ['openai', 'gpt-4o-mini', 0.01, 60_000],
    ['openai', 'gpt-4o', 0.5, DAY],
    ['anthropic', 'claude-3-haiku', 0.2, 2 * DAY],
    ['gemini', 'gemini-2.0-flash', 0.05, 10 * DAY],
]
seed.forEach(([provider, model, cost, age], index) => {
    db.insertTrace({
        id: `analytics-${index}`,
        timestamp: now - age,
        provider,
        model,
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        estimated_cost: cost,
        duration_ms: 100,
    })
})

describe('Cost by Tool', () => {
    test('getCostByTool returns array', () => {
        expect(db.getCostByTool({ days: 30 })).toBeArray()
    })

    test('getCostByTool items have expected fields', () => {
        const byTool = rows(db.getCostByTool({ days: 30 }))
        expect(byTool.length).toBeGreaterThan(0)
        for (const key of [
            'provider',
            'total_cost',
            'total_tokens',
            'prompt_tokens',
            'completion_tokens',
            'request_count',
        ]) {
            expect(byTool[0]).toHaveProperty(key)
        }
    })

    test('getCostByTool orders by total_cost descending', () => {
        const costs = rows(db.getCostByTool({ days: 30 })).map((item) => Number(item.total_cost))
        expect(costs).toEqual([...costs].sort((a, b) => b - a))
        expect(rows(db.getCostByTool({ days: 30 }))[0]?.provider).toBe('openai')
    })
})

describe('Model aggregates', () => {
    const lastMonth = () => ({ from: Date.now() - 30 * 24 * 60 * 60 * 1000 })

    test('by cost: totals per model, most expensive first', () => {
        const byModel = db.getModelAggregates({ ...lastMonth(), orderBy: 'cost' })
        expect(byModel.length).toBeGreaterThan(0)
        for (const key of ['model', 'provider', 'total_cost', 'total_tokens', 'request_count'])
            expect(byModel[0]).toHaveProperty(key)
        const costs = byModel.map((item) => item.total_cost)
        expect(costs).toEqual([...costs].sort((a, b) => b - a))
        expect(byModel[0]?.model).toBe('gpt-4o')
    })

    test('by requests: the same rows ordered by request count', () => {
        const byRequests = db.getModelAggregates(lastMonth())
        const counts = byRequests.map((item) => item.request_count)
        expect(counts).toEqual([...counts].sort((a, b) => b - a))
        const byCost = db.getModelAggregates({ ...lastMonth(), orderBy: 'cost' })
        const sorted = (rows: ModelAggregate[]) =>
            [...rows].sort((a, b) => a.model.localeCompare(b.model))
        expect(sorted(byRequests)).toEqual(sorted(byCost))
    })

    test('an empty window has no rows', () => {
        expect(db.getModelAggregates({ from: Date.now() + 60_000 })).toEqual([])
    })
})

describe('Daily Stats', () => {
    test('getDailyStats returns array', () => {
        expect(db.getDailyStats({ days: 30 })).toBeArray()
    })

    test('getDailyStats items have expected fields', () => {
        const daily = rows(db.getDailyStats({ days: 30 }))
        expect(daily.length).toBeGreaterThan(0)
        for (const key of ['bucket', 'date', 'tokens', 'cost', 'requests']) {
            expect(daily[0]).toHaveProperty(key)
        }
    })

    test('getDailyStats date format is YYYY-MM-DD', () => {
        for (const item of rows(db.getDailyStats({ days: 30 }))) {
            expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
    })

    test('getDailyStats orders by bucket ascending', () => {
        const buckets = rows(db.getDailyStats({ days: 30 })).map((item) => Number(item.bucket))
        expect(buckets).toEqual([...buckets].sort((a, b) => a - b))
    })
})

describe('Edge Cases', () => {
    test('getCostByTool with 0 days returns empty', () => {
        expect(db.getCostByTool({ days: 0 })).toHaveLength(0)
    })

    test('getDailyStats with 0 days returns empty', () => {
        expect(db.getDailyStats({ days: 0 })).toHaveLength(0)
    })

    test('getCostByTool with default params works', () => {
        expect(db.getCostByTool()).toBeArray()
    })

    test('getModelAggregates with default params works', () => {
        expect(db.getModelAggregates()).toBeArray()
    })

    test('getDailyStats with default params works', () => {
        expect(db.getDailyStats()).toBeArray()
    })
})
