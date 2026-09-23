// The LLM proxy listener: provider routes, native passthrough routes, health and discovery.
import * as db from '@llmflow/db'
import { passthroughProviders, registry } from '@llmflow/providers'
import { forwardProxyRequest } from './proxy'

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
}

// Browser clients call the proxy directly, so every response carries CORS headers.
function withCors(response: Response) {
    const headers = new Headers(response.headers)
    for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value)
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    })
}

async function route(req: Request, url: URL, port: number): Promise<Response> {
    if (url.pathname === '/health')
        return Response.json({
            status: 'ok',
            service: 'proxy',
            port,
            traces: db.getTraceCount(),
            uptime: process.uptime(),
            providers: registry.list().map((p: { name: string }) => p.name),
        })

    if (url.pathname === '/providers')
        return Response.json({
            providers: registry.list(),
            passthrough: Object.entries(passthroughProviders).map(([prefix, provider]) => ({
                name: provider.name,
                display_name: provider.displayName,
                prefix: `/passthrough/${prefix}/*`,
            })),
            usage: {
                default: 'Use /v1/* for OpenAI (default provider)',
                custom: 'Use /{provider}/v1/* for other providers (e.g., /ollama/v1/chat/completions)',
                header: 'Or set X-LLMFlow-Provider header to override',
                passthrough:
                    'Use /passthrough/{provider}/* for native API formats (e.g., /passthrough/anthropic/v1/messages)',
            },
        })

    if (req.method === 'OPTIONS') return new Response(null, { status: 200 })

    for (const [name, provider] of Object.entries(passthroughProviders)) {
        const prefix = `/passthrough/${name}`
        if (url.pathname.startsWith(`${prefix}/`))
            return forwardProxyRequest(req, url, { provider, prefix })
    }
    return forwardProxyRequest(req, url)
}

export function createProxyServer(hostname: string, port: number) {
    return Bun.serve({
        hostname,
        port,
        idleTimeout: 0,
        async fetch(req, server) {
            return withCors(await route(req, new URL(req.url), server.port!))
        },
    })
}
