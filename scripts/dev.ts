import {
    available,
    backendUrl,
    clientUrl,
    frontendOrigins,
    port,
    publish,
    root,
    runtimes,
} from './dev-runtime'

const mode = process.argv[2] || 'all'
if (['--help', '-h'].includes(mode)) {
    console.log(
        'Usage: bun scripts/dev.ts [all|server|dashboard|demo|status]\nDevelopment uses preferred ports and automatically falls back when occupied.\nDASHBOARD_PORT=1337 PROXY_PORT=8080 VITE_PORT=5173\nSplit commands discover live servers from this checkout; LLMFLOW_URL overrides discovery.',
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
        [process.execPath, `${root}/apps/server/test/demo.js`, ...process.argv.slice(3)],
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
} else if (['all', 'server', 'dashboard'].includes(mode)) {
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
                console.error('[llmflow] Cleanup failed:', error)
            }
        }
        clearTimeout(timeout)
        process.exit(code)
    }
    process.on('SIGINT', () => void stop())
    process.on('SIGTERM', () => void stop())
    try {
        // Validate all selected ports before opening listeners.
        if (mode !== 'dashboard') {
            port('DASHBOARD_PORT', 1337)
            port('PROXY_PORT', 8080)
        }
        if (mode !== 'server') port('VITE_PORT', 5173)
        let ownBackend: string | undefined
        if (mode !== 'dashboard') {
            const { startDashboardServer, startProxyServer } =
                await import('../apps/server/src/server')
            const db = await import('../packages/db/src/index')
            const { initExportHooks, EXPORT_ENABLED } = require('../packages/otlp/src/export')
            cleanup.push(() => db.close())
            if (EXPORT_ENABLED) cleanup.push(initExportHooks(db))
            const dashboard = available('Dashboard/OTLP', port('DASHBOARD_PORT', 1337), (value) =>
                startDashboardServer(value, frontendOrigins),
            )
            cleanup.push(() => dashboard.stop(true))
            const proxy = available('Proxy', port('PROXY_PORT', 8080), startProxyServer)
            cleanup.push(() => proxy.stop(true))
            ownBackend = clientUrl(dashboard.url)
            cleanup.push(publish({ kind: 'backend', url: ownBackend, proxy: clientUrl(proxy.url) }))
            console.log(`[llmflow] Dashboard/OTLP: ${ownBackend}`)
            console.log(`[llmflow] Proxy:          ${clientUrl(proxy.url)}`)
        }
        if (mode !== 'server') {
            const { startFrontend } = await import('../apps/dashboard/dev')
            cleanup.push(await startFrontend(ownBackend))
        }
        console.log('[llmflow] Ready. Press Ctrl+C to stop.')
    } catch (error) {
        console.error(`[llmflow] Startup failed: ${(error as Error).message}`)
        await stop(1)
    }
} else {
    console.error(`Unknown dev command: ${mode}. Use --help.`)
    process.exitCode = 1
}
