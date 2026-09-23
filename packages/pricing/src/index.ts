import { log } from '@llmflow/shared/logger'
import bundled from '../pricing.fallback.json' with { type: 'json' }

export type ModelPricing = {
    input_cost_per_token?: number
    output_cost_per_token?: number
}

export type PricingFallback = {
    generated_at: string
    source: string
    models: Record<string, ModelPricing>
}

export type PricingStatus = {
    source: 'litellm' | 'fallback' | 'unknown'
    last_updated: number | null
    model_count: number
    upstream_url: string
}

const DEFAULT_PRICING_URL =
    'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const PRICING_URL = process.env.PRICING_URL || DEFAULT_PRICING_URL
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000

const fallback = bundled as PricingFallback

let pricingData: Record<string, ModelPricing> = {}
let lastUpdated: number | null = null
let pricingSource: PricingStatus['source'] = 'unknown'

function loadFallbackPricing() {
    pricingData = fallback.models
    pricingSource = 'fallback'
    // The generation time, not the file mtime: an install or checkout must not look fresh.
    lastUpdated = Date.parse(fallback.generated_at)
}

async function loadPricing() {
    try {
        const response = await fetch(PRICING_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        pricingData = (await response.json()) as Record<string, ModelPricing>
        lastUpdated = Date.now()
        pricingSource = 'litellm'
        log.debug(`[pricing] Loaded ${Object.keys(pricingData).length} models`)
    } catch (error) {
        log.debug(`[pricing] Using ${pricingSource} pricing: ${(error as Error).message}`)
    }
}

function normalizeModelName(model: string) {
    const normalized = model.toLowerCase().trim()
    for (const prefix of ['openai/', 'anthropic/', 'google/', 'azure/', 'together/']) {
        if (normalized.startsWith(prefix)) return normalized.slice(prefix.length)
    }
    return normalized
}

function findModelPricing(modelName: string | null | undefined): ModelPricing | null {
    if (!modelName) return null
    const normalized = normalizeModelName(modelName)
    if (!normalized) return null

    // LiteLLM keys some providers' models with a provider prefix (gemini/gemini-2.5-pro).
    for (const prefix of ['', 'openai/', 'azure/', 'gemini/']) {
        const pricing = pricingData[prefix + normalized]
        if (pricing) return pricing
    }

    // Versioned names fall back to a related entry (gpt-4-0125-preview -> gpt-4).
    const baseName = normalized.split('-').slice(0, 2).join('-')
    for (const key of Object.keys(pricingData)) {
        if (key.startsWith(baseName) || key.includes(normalized)) return pricingData[key] ?? null
    }
    return null
}

export function calculateCost(
    model: string | null | undefined,
    promptTokens: number,
    completionTokens: number,
) {
    const pricing = findModelPricing(model)
    if (!pricing) return (promptTokens * 0.001 + completionTokens * 0.002) / 1000

    // LiteLLM prices are per token, not per 1k.
    const inputCost = pricing.input_cost_per_token || 0
    const outputCost = pricing.output_cost_per_token || pricing.input_cost_per_token || 0
    return promptTokens * inputCost + completionTokens * outputCost
}

export function getPricingStatus(): PricingStatus {
    return {
        source: pricingSource,
        last_updated: lastUpdated,
        model_count: Object.keys(pricingData).length,
        upstream_url: PRICING_URL,
    }
}

loadFallbackPricing()
export const ready = loadPricing()
setInterval(loadPricing, REFRESH_INTERVAL_MS).unref()
