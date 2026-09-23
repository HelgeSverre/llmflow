import { expect, it } from 'vitest'
import { PRICING_STALE_MS, stalePricingDays, type PricingStatus } from './pricing'

const now = Date.parse('2026-09-23T12:00:00Z')
const status = (overrides: Partial<PricingStatus>): PricingStatus => ({
  source: 'fallback',
  last_updated: now,
  model_count: 782,
  upstream_url: 'https://example.invalid/pricing.json',
  ...overrides,
})

it('flags a fallback older than the threshold with its age in days', () => {
  expect(stalePricingDays(status({ last_updated: now - 30 * 86_400_000 }), now)).toBe(30)
})

it('does not flag a fallback within the threshold', () => {
  expect(stalePricingDays(status({ last_updated: now - PRICING_STALE_MS }), now)).toBeNull()
  expect(stalePricingDays(status({ last_updated: now - 86_400_000 }), now)).toBeNull()
})

it('never flags live pricing, unknown sources or a missing timestamp', () => {
  const old = now - 90 * 86_400_000
  expect(stalePricingDays(status({ source: 'litellm', last_updated: old }), now)).toBeNull()
  expect(stalePricingDays(status({ source: 'unknown', last_updated: old }), now)).toBeNull()
  expect(stalePricingDays(status({ last_updated: null }), now)).toBeNull()
  expect(stalePricingDays(null, now)).toBeNull()
})
