import path from 'node:path'
import { log } from '@llmflow/shared/logger'
import {
    available,
    backendUrl,
    clientUrl,
    frontendOrigins,
    port,
    publish,
    runtimes,
} from '@llmflow/dev-runtime'

const mode = process.argv[2] || 'server'
if (['--help', '-h'].includes(mode)) {
    console.log(
        'Usage: bun scripts/dev.ts [server|demo|status]\nDevelopment uses preferred ports and automatically falls back when occupied.\nDASHBOARD_PORT=1337 PROXY_PORT=8080\nThe dashboard dev server (apps/dashboard) discovers this server through a per-checkout state directory; LLMFLOW_URL overrides discovery.',
    )
} else if (mode === 'status') {
    const live = runtimes()
    for (const runtime of live)
        console.log(
            `${runtime.kind} (PID ${runtime.pid}): ${runtime.url}${runtime.proxy ? `  proxy: ${runtime.proxy}` : ''}`,
        )
    if (!live.length) console.log('No running development servers found for this checkout.')
} else if (mode === 'demo') {
    const target = backendUrl() || `http://127.0.0.1:${port('DASHBOARD_PORT', 1337)}`
    const child = Bun.spawn(
        [process.execPath, path.join(import.meta.dir, 'demo.ts'), ...process.argv.slice(3)],
        {
            env: { ...process.env, LLMFLOW_URL: target },
            stdin: 'inherit',
            stdout: 'inherit',
            stderr: 'inherit',
        },
    )
    process.on('SIGINT', () => child.kill('SIGINT'))
    process.on('SIGTERM', () => child.kill('SIGTERM'))
    process.exitCode = await child.exited
} else if (mode === 'server') {
    const cleanup: Array<() => unknown | Promise<unknown>> = []
    let stopping = false
    const stop = async (code = 0) => {
        if (stopping) return
        stopping = true
        const timeout = setTimeout(() => process.exit(code), 5000)
        for (const close of cleanup.reverse()) {
            try {
                await close()
            } catch (error) {
                log.error('Cleanup failed', error)
            }
        }
        clearTimeout(timeout)
        process.exit(code)
    }
    process.on('SIGINT', () => void stop())
    process.on('SIGTERM', () => void stop())
    try {
        // Validate all selected ports before opening listeners.
        port('DASHBOARD_PORT', 1337)
        port('PROXY_PORT', 8080)
        const { startDashboardServer, startProxyServer } = await import('../src/server')
        const db = await import('@llmflow/db')
        const { initExportHooks, EXPORT_ENABLED } = require('@llmflow/otlp/export')
        cleanup.push(() => db.close())
        if (EXPORT_ENABLED) cleanup.push(initExportHooks(db))
        const dashboard = available('Dashboard/OTLP', port('DASHBOARD_PORT', 1337), (value) =>
            startDashboardServer(value, frontendOrigins),
        )
        cleanup.push(() => dashboard.stop(true))
        const proxy = available('Proxy', port('PROXY_PORT', 8080), startProxyServer)
        cleanup.push(() => proxy.stop(true))
        const url = clientUrl(dashboard.url)
        cleanup.push(publish({ kind: 'backend', url, proxy: clientUrl(proxy.url) }))
        log.info(`Dashboard/OTLP: ${url}`)
        log.info(`Proxy:          ${clientUrl(proxy.url)}`)
        log.info('Ready. Press Ctrl+C to stop.')
    } catch (error) {
        log.error(`Startup failed: ${(error as Error).message}`)
        await stop(1)
    }
} else {
    console.error(`Unknown dev command: ${mode}. Use --help.`)
    process.exitCode = 1
}
