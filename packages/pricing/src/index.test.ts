import { expect, test } from 'bun:test'
import fallback from '../pricing.fallback.json' with { type: 'json' }

// Offline: the upstream fetch must fail so only the bundled fallback is in use.
process.env.PRICING_URL = 'https://127.0.0.1:1/pricing.json'
const pricing = await import('./index')
await pricing.ready

test('offline status reports the fallback generation time, not the file mtime', () => {
    const status = pricing.getPricingStatus()
    expect(status.source).toBe('fallback')
    expect(status.last_updated).toBe(Date.parse(fallback.generated_at))
    expect(status.model_count).toBe(Object.keys(fallback.models).length)
})

test.each([
    ['gpt-5', 'gpt-5'],
    ['claude-sonnet-4-5', 'claude-sonnet-4-5'],
    ['gemini-2.5-pro', 'gemini/gemini-2.5-pro'],
    ['openai/gpt-5', 'gpt-5'],
])('offline pricing prices %s from the fallback', (model, key) => {
    const rate = (
        fallback.models as Record<
            string,
            { input_cost_per_token: number; output_cost_per_token: number }
        >
    )[key]!
    expect(rate.input_cost_per_token).toBeGreaterThan(0)
    expect(pricing.calculateCost(model, 1000, 500)).toBeCloseTo(
        1000 * rate.input_cost_per_token + 500 * rate.output_cost_per_token,
        12,
    )
})

test('the fallback carries a parseable generated_at and only priced models', () => {
    expect(Number.isNaN(Date.parse(fallback.generated_at))).toBe(false)
    for (const entry of Object.values(fallback.models)) {
        expect(typeof entry.input_cost_per_token).toBe('number')
    }
})
