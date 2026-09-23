// Wires the two listeners: the dashboard (UI, JSON API, OTLP receiver, WebSocket) and the LLM proxy.
import * as db from '@llmflow/db'
import { getConfig as getExportConfig, initExportHooks } from '@llmflow/otlp/export'
import { log } from '@llmflow/shared/logger'
import { parsePort } from '@llmflow/shared/net'
import { handleApiRoute } from './api'
import { addLiveClient, removeLiveClient } from './live'
import { handleOtlpRoute, isOtlpPath } from './otlp-routes'
import { createProxyServer } from './proxy-server'
import { serveStatic } from './static'
import { trustedWebSocketOrigin } from './websocket-origin'

const PROXY_HOST = process.env.PROXY_HOST || '127.0.0.1'
const DASHBOARD_HOST = process.env.DASHBOARD_HOST || '127.0.0.1'
const PROXY_PORT = parsePort('PROXY_PORT', 8080)
const DASHBOARD_PORT = parsePort('DASHBOARD_PORT', 1337)

export function startDashboardServer(
    port = DASHBOARD_PORT,
    allowedOrigins: () => string[] = () => [],
) {
    return Bun.serve({
        hostname: DASHBOARD_HOST,
        port,
        websocket: {
            open: addLiveClient,
            message() {},
            close: removeLiveClient,
        },
        async fetch(req, server) {
            const url = new URL(req.url)
            if (url.pathname === '/ws') {
                if (!trustedWebSocketOrigin(req, DASHBOARD_HOST, server.port!, allowedOrigins()))
                    return new Response('Untrusted WebSocket origin', { status: 403 })
                if (server.upgrade(req)) return new Response(null)
                return new Response('WebSocket upgrade failed', { status: 400 })
            }
            if (url.pathname.startsWith('/api/')) return handleApiRoute(req, url)
            if (isOtlpPath(url.pathname)) return handleOtlpRoute(req, url)
            return serveStatic(url.pathname)
        },
    })
}

export function startProxyServer(port = PROXY_PORT) {
    return createProxyServer(PROXY_HOST, port)
}

// Only direct execution (`bun src/server.ts`) starts listeners; importing this module does not.
function main() {
    const stopExport = initExportHooks(db)
    if (getExportConfig().enabled) log.info('OTLP export enabled')

    const dashboard = startDashboardServer()
    const proxy = startProxyServer()

    let stopping = false
    const shutdown = async () => {
        if (stopping) process.exit(0)
        stopping = true
        const deadline = setTimeout(() => process.exit(0), 5000)
        try {
            await Promise.all([dashboard.stop(), proxy.stop()])
            // Unsubscribes the exporter and flushes whatever is still queued.
            await stopExport()
        } catch (error) {
            log.error('Shutdown flush failed', error)
        } finally {
            clearTimeout(deadline)
            process.exit(0)
        }
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    log.info(`Dashboard: ${dashboard.url}`)
    log.info(`Proxy:     ${proxy.url}`)
}

if (import.meta.main) main()
