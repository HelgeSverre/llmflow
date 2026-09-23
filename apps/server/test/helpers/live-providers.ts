import { expect } from 'bun:test'

// Cheap default model per provider; override with LLMFLOW_TEST_<PROVIDER>_MODEL.
const defaults = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-haiku-4-5',
    gemini: 'gemini-2.5-flash-lite',
    groq: 'openai/gpt-oss-20b',
    mistral: 'mistral-small-latest',
    cohere: 'command-r7b-12-2024',
    together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ollama: 'llama3.2:1b',
}

export type LiveProvider = keyof typeof defaults | 'azure'

export const models = Object.fromEntries(
    Object.entries(defaults).map(([provider, model]) => [
        provider,
        process.env[`LLMFLOW_TEST_${provider.toUpperCase()}_MODEL`] || model,
    ]),
) as Record<keyof typeof defaults, string>

const selected = process.env.PROVIDERS?.split(',').map((name) => name.trim().toLowerCase())

// A provider runs when PROVIDERS (comma-separated) is unset or names it, and
// every listed environment variable is set.
export function enabled(provider: LiveProvider, ...keys: string[]) {
    return (!selected || selected.includes(provider)) && keys.every((key) => !!process.env[key])
}

export const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''

export const LIVE_TIMEOUT = 60000

export async function post(url: string, headers: Record<string, string>, body: unknown) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    if (response.status >= 400) throw new Error(`HTTP ${response.status}: ${text}`)
    return JSON.parse(text)
}

// The proxy records the call after answering, so poll briefly for the row.
export async function expectTraceLogged(dashboardUrl: string, provider: string) {
    const deadline = Date.now() + 2000
    let providers: string[] = []
    while (Date.now() < deadline) {
        const traces = (await (await fetch(`${dashboardUrl}/api/traces?limit=50`)).json()) as any[]
        providers = traces.map((trace) => trace.provider)
        if (providers.includes(provider)) return
        await Bun.sleep(50)
    }
    expect(providers).toContain(provider)
}
