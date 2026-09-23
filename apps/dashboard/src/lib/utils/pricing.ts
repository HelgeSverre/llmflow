export type PricingStatus = {
  source: 'litellm' | 'fallback' | 'unknown'
  last_updated: number | null
  model_count: number
  upstream_url: string
}

const DAY_MS = 24 * 60 * 60 * 1000
export const PRICING_STALE_MS = 7 * DAY_MS

// Only the bundled fallback can go stale: live LiteLLM data is refreshed daily by the server.
export function stalePricingDays(pricing: PricingStatus | null | undefined, now: number) {
  if (pricing?.source !== 'fallback' || pricing.last_updated === null) return null
  const age = now - pricing.last_updated
  return age > PRICING_STALE_MS ? Math.floor(age / DAY_MS) : null
}
