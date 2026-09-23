// Regenerates packages/pricing/pricing.fallback.json from LiteLLM, keeping only the
// chat-capable models of the providers LLMFlow proxies and the two fields calculateCost reads.
import path from 'node:path'

const SOURCE =
    'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const PROVIDERS = new Set([
    'openai',
    'anthropic',
    'gemini',
    'mistral',
    'groq',
    'together_ai',
    'perplexity',
    'openrouter',
    'cohere',
    'cohere_chat',
])
const MODES = new Set(['chat', 'responses', 'completion'])

type Entry = {
    litellm_provider?: string
    mode?: string
    input_cost_per_token?: number
    output_cost_per_token?: number
}

const response = await fetch(SOURCE, { signal: AbortSignal.timeout(30_000) })
if (!response.ok) throw new Error(`LiteLLM pricing fetch failed: HTTP ${response.status}`)
const upstream = (await response.json()) as Record<string, Entry>

const models: Record<string, { input_cost_per_token: number; output_cost_per_token?: number }> = {}
for (const key of Object.keys(upstream).sort()) {
    const entry = upstream[key]
    if (typeof entry !== 'object' || entry === null) continue
    if (!PROVIDERS.has(entry.litellm_provider ?? '') || !MODES.has(entry.mode ?? '')) continue
    if (typeof entry.input_cost_per_token !== 'number') continue
    models[key] = {
        input_cost_per_token: entry.input_cost_per_token,
        ...(typeof entry.output_cost_per_token === 'number'
            ? { output_cost_per_token: entry.output_cost_per_token }
            : {}),
    }
}

const target = path.resolve(import.meta.dir, '../packages/pricing/pricing.fallback.json')
const fallback = { generated_at: new Date().toISOString(), source: SOURCE, models }
await Bun.write(target, JSON.stringify(fallback, null, 2) + '\n')
console.log(`Wrote ${Object.keys(models).length} models to ${path.relative(process.cwd(), target)}`)
