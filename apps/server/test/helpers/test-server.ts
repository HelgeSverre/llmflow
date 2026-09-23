import { spawn, type SpawnOptions } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'

type Env = Record<string, string | undefined>

export interface TestServer {
    url: string
    proxyUrl: string | null
    db: typeof import('@llmflow/db')
    directory: string
    dbPath: string
    dashboard: ReturnType<typeof import('../../src/server').startDashboardServer>
    proxy: ReturnType<typeof import('../../src/server').startProxyServer> | null
    stop(): Promise<void>
}

export function tempDirectory(prefix = 'llmflow-test-') {
    return mkdtempSync(path.join(tmpdir(), prefix))
}

// Environment for a server that owns a temp database, binds loopback on
// ephemeral ports and never reaches the network for pricing or export.
// A value of undefined removes the variable.
export function isolatedEnv(directory: string, overrides: Env = {}): Env {
    return {
        DATA_DIR: directory,
        DB_PATH: path.join(directory, 'test.db'),
        DASHBOARD_HOST: '127.0.0.1',
        PROXY_HOST: '127.0.0.1',
        DASHBOARD_PORT: '0',
        PROXY_PORT: '0',
        LLMFLOW_URL: undefined,
        PRICING_URL: 'https://127.0.0.1:1/pricing.json',
        OTLP_EXPORT_ENABLED: 'false',
        OTLP_EXPORT_ENDPOINT: undefined,
        OTLP_EXPORT_TRACES_ENDPOINT: undefined,
        OTLP_EXPORT_LOGS_ENDPOINT: undefined,
        OTLP_EXPORT_METRICS_ENDPOINT: undefined,
        ...overrides,
    }
}

export function childEnv(env: Env): Record<string, string> {
    const merged: Env = { ...process.env, ...env }
    return Object.fromEntries(
        Object.entries(merged).filter((entry): entry is [string, string] => entry[1] !== undefined),
    )
}

function applyEnv(env: Env) {
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
}

// Starts the dashboard (and optionally the proxy) in this process. The server
// and database modules read their configuration at import time, so call this
// once per test file (bun test --isolate gives every file a fresh registry)
// and register any mock.module() before calling it.
export async function startTestServer(
    options: { proxy?: boolean; env?: Env; prefix?: string } = {},
): Promise<TestServer> {
    const directory = tempDirectory(options.prefix)
    const env = isolatedEnv(directory, options.env)
    applyEnv(env)
    const db = await import('@llmflow/db')
    const { startDashboardServer, startProxyServer } = await import('../../src/server')
    const dashboard = startDashboardServer(0)
    const proxy = options.proxy ? startProxyServer(0) : null
    let stopped = false
    return {
        url: dashboard.url.origin,
        proxyUrl: proxy ? proxy.url.origin : null,
        db,
        directory,
        dbPath: env.DB_PATH!,
        dashboard,
        proxy,
        async stop() {
            if (stopped) return
            stopped = true
            await Promise.all([dashboard.stop(true), proxy?.stop(true)])
            db.close()
            rmSync(directory, { recursive: true, force: true })
        },
    }
}

export async function freePort() {
    const socket = createServer()
    await new Promise<void>((resolve, reject) => {
        socket.once('error', reject)
        socket.listen(0, '127.0.0.1', resolve)
    })
    const { port } = socket.address() as AddressInfo
    await new Promise((resolve) => socket.close(resolve))
    return port
}

// Resolves 0 on a clean exit and 1 on a non-zero code, a signal or a launch error.
export function runChild(command: string, args: string[], options: SpawnOptions = {}) {
    return new Promise<0 | 1>((resolve) => {
        const child = spawn(command, args, options)
        child.once('error', () => resolve(1))
        child.once('close', (code, signal) => resolve(signal || code !== 0 ? 1 : 0))
    })
}
