#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:net'

export async function freePort() {
    const socket = createServer()
    await new Promise((resolve, reject) => {
        socket.once('error', reject)
        socket.listen(0, '127.0.0.1', resolve)
    })
    const port = socket.address().port
    await new Promise((resolve) => socket.close(resolve))
    return port
}
export function runChild(command, args, options = {}, onSpawn = () => {}) {
    return new Promise((resolve) => {
        const child = spawn(command, args, options)
        onSpawn(child)
        child.once('error', () => resolve(1))
        child.once('close', (code, signal) => resolve(signal || code !== 0 ? 1 : 0))
    })
}
async function main() {
    const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-suite-'))
    const dashboardPort = await freePort(),
        proxyPort = await freePort()
    const env = {
        ...process.env,
        DATA_DIR: directory,
        DB_PATH: path.join(directory, 'test.db'),
        DASHBOARD_HOST: '127.0.0.1',
        PROXY_HOST: '127.0.0.1',
        DASHBOARD_PORT: String(dashboardPort),
        PROXY_PORT: String(proxyPort),
        LLMFLOW_URL: `http://127.0.0.1:${dashboardPort}`,
        PROXY_URL: `http://127.0.0.1:${proxyPort}`,
        NODE_ENV: 'test',
        PRICING_URL: 'https://127.0.0.1:1/pricing.json',
        OTLP_EXPORT_ENABLED: 'false',
        OTLP_EXPORT_ENDPOINT: '',
        OTLP_EXPORT_TRACES_ENDPOINT: '',
        OTLP_EXPORT_LOGS_ENDPOINT: '',
        OTLP_EXPORT_METRICS_ENDPOINT: '',
    }
    const testFiles = process.argv.slice(2).length
        ? process.argv.slice(2)
        : readdirSync(import.meta.dir)
              .filter((name) => !['providers-e2e.js', 'passthrough-e2e.js'].includes(name))
              .filter(
                  (name) =>
                      /(?:-e2e\.js|\.test\.ts)$/.test(name) ||
                      ['providers.js', 'passthrough.js'].includes(name),
              )
              .sort()
    const server = spawn(process.execPath, [path.resolve(import.meta.dir, '../src/server.ts')], {
        env,
        stdio: ['ignore', 'ignore', 'pipe'],
    })
    let failed = false,
        stopped = false
    server.on('error', () => {
        stopped = true
    })
    server.on('exit', () => {
        stopped = true
    })
    server.stderr.on('data', (data) => process.stderr.write(data))
    let activeTest = null
    const terminate = () => {
        failed = true
        activeTest?.kill('SIGTERM')
        server.kill('SIGTERM')
    }
    process.once('SIGINT', terminate)
    process.once('SIGTERM', terminate)
    try {
        let ready = false
        for (let attempt = 0; attempt < 100 && !stopped; attempt++) {
            try {
                ready = (
                    await fetch(`${env.LLMFLOW_URL}/api/health`, {
                        signal: AbortSignal.timeout(500),
                    })
                ).ok
            } catch {}
            if (ready) break
            await Bun.sleep(100)
        }
        if (!ready) throw new Error('Isolated test server did not become ready')
        for (const name of testFiles) {
            if (stopped) throw new Error('Test server stopped unexpectedly')
            console.log(`Running ${name}`)
            const args = name.endsWith('.test.ts')
                ? ['test', path.join(import.meta.dir, name)]
                : [path.join(import.meta.dir, name)]
            if (
                (await runChild(
                    process.execPath,
                    args,
                    { env, stdio: 'inherit', timeout: 120000 },
                    (child) => {
                        activeTest = child
                    },
                )) !== 0
            )
                failed = true
            activeTest = null
        }
    } catch (error) {
        console.error(error)
        failed = true
    } finally {
        if (!stopped) {
            const exit = new Promise((resolve) => server.once('close', resolve))
            server.kill('SIGTERM')
            const timer = setTimeout(() => server.kill('SIGKILL'), 3000)
            await exit
            clearTimeout(timer)
        }
        process.off('SIGINT', terminate)
        process.off('SIGTERM', terminate)
        rmSync(directory, { recursive: true, force: true })
    }
    console.log(failed ? 'Some tests failed' : 'All tests passed')
    process.exitCode = failed ? 1 : 0
}
if (import.meta.main) await main()
