import * as db from '@llmflow/db'
import { safeJson } from '@llmflow/db'
import { registry } from '@llmflow/providers'
import { forwardProxyRequest } from './proxy'

const credentials: Record<string, string[]> = {
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    cohere: ['COHERE_API_KEY'],
    azure: ['AZURE_OPENAI_API_KEY'],
    groq: ['GROQ_API_KEY'],
    mistral: ['MISTRAL_API_KEY'],
    together: ['TOGETHER_API_KEY'],
    perplexity: ['PERPLEXITY_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
}

export async function replayTrace(id: string, signal: AbortSignal): Promise<Response> {
    const trace = db.getTraceById(id) as Record<string, unknown> | null
    if (!trace) return Response.json({ error: 'Trace not found' }, { status: 404 })
    const path = String(trace.request_path || '')
    const body = safeJson(trace.request_body, null) as Record<string, unknown> | null
    if (
        trace.request_method !== 'POST' ||
        !path.startsWith('/') ||
        path.startsWith('/passthrough/')
    ) {
        return Response.json(
            {
                error: 'Replay supports captured POST requests through the normalized provider proxy. Native passthrough and telemetry-only spans cannot be replayed.',
            },
            { status: 400 },
        )
    }
    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        !Object.keys(body).length ||
        body._truncated
    ) {
        return Response.json(
            {
                error: 'The request body is missing or incomplete. Capture the original request through the proxy again.',
            },
            { status: 400 },
        )
    }
    const url = new URL(path, 'http://localhost')
    if ([...url.searchParams.values()].includes('[REDACTED]')) {
        return Response.json(
            {
                error: 'The captured URL contains redacted parameters. Replay this request from the original client with fresh parameters.',
            },
            { status: 400 },
        )
    }
    const stored = safeJson(trace.request_headers, {}) as Record<string, string>
    const headers = new Headers({ 'content-type': 'application/json' })
    for (const name of [
        'x-llmflow-provider',
        'x-azure-resource',
        'x-llmflow-azure-resource',
        'anthropic-version',
        'anthropic-beta',
        'openai-organization',
        'openai-project',
    ]) {
        if (stored[name] && stored[name] !== '[REDACTED]') headers.set(name, stored[name])
    }
    const { provider } = registry.resolve({
        path: url.pathname,
        headers: Object.fromEntries(headers),
    })
    if (provider.name !== 'ollama') {
        const variables = credentials[provider.name]
        const key = variables?.map((name) => process.env[name]).find(Boolean)
        if (!key)
            return Response.json(
                {
                    error: `Set ${variables?.join(' or ') || 'the provider API key'} in the LLMFlow server environment and restart to replay this request.`,
                },
                { status: 400 },
            )
        headers.set('authorization', `Bearer ${key}`)
    }
    const traceId = crypto.randomUUID().replaceAll('-', '')
    headers.set('x-trace-id', traceId)
    const request = new Request(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
    })
    const response = await forwardProxyRequest(request, url)
    // Consume the existing streaming path without retaining a second response body.
    if (response.body) {
        const reader = response.body.getReader()
        try {
            while (!(await reader.read()).done) {}
        } finally {
            reader.releaseLock()
        }
    }
    const rows = db.getSpansByTraceId(traceId) as { id: string }[]
    if (!rows.length)
        return Response.json(
            { error: 'Replay produced no trace. Check the server log and provider configuration.' },
            { status: 502 },
        )
    return Response.json({ id: rows[0].id })
}
