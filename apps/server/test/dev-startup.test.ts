import { test, expect } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { waitUntil as waitFor } from '@llmflow/shared/net'
const root = path.resolve(import.meta.dir, '../../..')

async function fixture() {
    const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-dev-test-'))
    const state = path.join(directory, 'state')
    mkdirSync(state)
    const blockers = Array.from({ length: 3 }, () =>
        Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch: () => new Response('unrelated listener'),
        }),
    )
    const env = {
        ...process.env,
        DATA_DIR: directory,
        DB_PATH: path.join(directory, 'test.db'),
        LLMFLOW_DEV_STATE_DIR: state,
        DASHBOARD_HOST: '127.0.0.1',
        PROXY_HOST: '127.0.0.1',
        VITE_HOST: '127.0.0.1',
        DASHBOARD_PORT: String(blockers[0].port),
        PROXY_PORT: String(blockers[1].port),
        VITE_PORT: String(blockers[2].port),
        LLMFLOW_URL: '',
        OTLP_EXPORT_ENABLED: 'false',
        PRICING_URL: 'http://127.0.0.1:1/no',
    }
    const children: ChildProcess[] = []
    function launch(args: string[], overrides = {}) {
        let output = ''
        const child = spawn(args[0], args.slice(1), {
            cwd: root,
            env: { ...env, ...overrides },
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        children.push(child)
        child.stdout!.on('data', (data) => (output += data))
        child.stderr!.on('data', (data) => (output += data))
        return { child, output: () => output }
    }
    async function stop(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') {
        if (child.exitCode !== null || child.signalCode) return
        process.kill(-child.pid!, signal)
        await waitFor(
            () => child.exitCode !== null || !!child.signalCode,
            'Dev command did not stop',
            10000,
        )
    }
    function records() {
        return readdirSync(state)
            .filter((file) => file.endsWith('.json'))
            .map((file) => JSON.parse(readFileSync(path.join(state, file), 'utf8')))
    }
    // The server and dashboard dev processes each publish a record once they are listening.
    async function ready(run: ReturnType<typeof launch>, kinds: string[]) {
        await waitFor(() => {
            if (run.child.exitCode !== null || run.child.signalCode) throw new Error(run.output())
            const live = records().filter((record) => record.pid !== 2147483647)
            return kinds.every((kind) => live.some((record) => record.kind === kind))
        }, 'Startup did not become ready: ' + run.output())
        return records()
    }
    async function cleanup() {
        for (const child of children) {
            try {
                await stop(child)
            } catch {
                try {
                    process.kill(-child.pid!, 'SIGKILL')
                } catch {}
            }
        }
        for (const blocker of blockers) blocker.stop(true)
        rmSync(directory, { recursive: true, force: true })
    }
    return { directory, state, blockers, env, launch, stop, records, ready, cleanup }
}
async function websocket(url: string) {
    return new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(url.replace('http:', 'ws:') + '/ws', {
            headers: { Origin: url },
        } as any)
        const timer = setTimeout(() => {
            socket.close()
            reject(new Error('WebSocket timeout'))
        }, 5000)
        socket.onmessage = (event) => {
            clearTimeout(timer)
            try {
                expect(JSON.parse(String(event.data)).type).toBe('hello')
                resolve()
            } catch (error) {
                reject(error)
            }
            socket.close()
        }
        socket.onerror = () => {
            clearTimeout(timer)
            reject(new Error('WebSocket failed: ' + url))
            socket.close()
        }
    })
}

test.skipIf(!Bun.which('just'))(
    'just dev falls back for every occupied port and wires API, WebSocket, demo and status',
    async () => {
        const f = await fixture()
        try {
            const run = f.launch(['just', 'dev'])
            const records = await f.ready(run, ['backend', 'frontend'])
            const backend = records.find((r: any) => r.kind === 'backend')
            const frontend = records.find((r: any) => r.kind === 'frontend')
            for (const url of [backend.url, backend.proxy, frontend.url])
                expect(f.blockers.some((b) => String(b.port) === new URL(url).port)).toBe(false)
            expect(await (await fetch(frontend.url)).text()).toContain('/@vite/client')
            expect((await fetch(frontend.url + '/src/main.ts')).ok).toBe(true)
            expect((await fetch(frontend.url + '/api/health')).ok).toBe(true)
            expect(await (await fetch(backend.proxy + '/health')).json()).toMatchObject({
                port: Number(new URL(backend.proxy).port),
            })
            await websocket(frontend.url)
            for (const command of ['demo', 'demo-many']) {
                const demo = f.launch(['just', command])
                await waitFor(
                    () => demo.child.exitCode !== null,
                    `${command} did not finish`,
                    45000,
                )
                expect(demo.child.exitCode).toBe(0)
            }
            expect(
                ((await (await fetch(backend.url + '/api/traces')).json()) as unknown[]).length,
            ).toBeGreaterThan(0)
            const status = f.launch(['just', 'status'])
            await waitFor(() => status.child.exitCode !== null, 'status did not finish')
            expect(status.output()).toContain(backend.url)
            expect(status.output()).toContain(frontend.url)
            await f.stop(run.child, 'SIGINT')
            await waitFor(async () => {
                try {
                    await fetch(backend.url + '/api/health')
                    return false
                } catch {
                    return true
                }
            }, 'Backend listener leaked')
            await waitFor(async () => {
                try {
                    await fetch(frontend.url)
                    return false
                } catch {
                    return true
                }
            }, 'Frontend listener leaked')
            await waitFor(() => f.records().length === 0, 'Discovery records leaked')
            for (const blocker of f.blockers)
                expect(await (await fetch(blocker.url)).text()).toBe('unrelated listener')
        } finally {
            await f.cleanup()
        }
    },
    90000,
)

test.skipIf(!Bun.which('just'))(
    'split dev recipes follow backend restarts and reject stale discovery records',
    async () => {
        const f = await fixture()
        let oldPort: ReturnType<typeof Bun.serve> | undefined
        try {
            writeFileSync(
                path.join(f.state, 'backend-stale.json'),
                JSON.stringify({
                    kind: 'backend',
                    pid: 2147483647,
                    started: Date.now() + 99999,
                    url: f.blockers[0].url.origin,
                }),
            )
            const front = f.launch(['just', 'dev-dashboard'])
            await f.ready(front, ['frontend'])
            const frontend = f.records().find((r: any) => r.kind === 'frontend')
            const first = f.launch(['just', 'dev-server'])
            await f.ready(first, ['backend'])
            const backend = f
                .records()
                .find((r: any) => r.kind === 'backend' && r.pid !== 2147483647)
            expect((await fetch(frontend.url + '/api/health')).ok).toBe(true)
            await websocket(frontend.url)
            await f.stop(first.child)
            await waitFor(async () => {
                try {
                    await fetch(backend.url + '/api/health')
                    return false
                } catch {
                    return true
                }
            }, 'First backend listener leaked')
            oldPort = Bun.serve({
                hostname: '127.0.0.1',
                port: Number(new URL(backend.url).port),
                fetch: () => new Response('old port now occupied', { status: 418 }),
            })
            const second = f.launch(['just', 'dev-server'])
            await f.ready(second, ['backend'])
            expect((await fetch(frontend.url + '/api/health')).ok).toBe(true)
            await websocket(frontend.url)
        } finally {
            oldPort?.stop(true)
            await f.cleanup()
        }
    },
    60000,
)

for (const [name, overrides, message] of [
    ['invalid configuration', { VITE_PORT: 'not-a-port' }, 'VITE_PORT must be a port'],
    ['a frontend bind failure', { VITE_HOST: '256.256.256.256' }, 'Startup failed:'],
] as const)
    test(`${name} stops the combined dev command without leaving listeners behind`, async () => {
        const f = await fixture()
        try {
            const run = f.launch(['bun', 'run', 'dev'], overrides)
            await waitFor(() => run.child.exitCode !== null, 'Failed startup did not exit')
            expect(run.child.exitCode).not.toBe(0)
            expect(run.output()).toContain(message)
            await waitFor(() => f.records().length === 0, 'Discovery records leaked')
            const url = run.output().match(/Dashboard\/OTLP: (http:\/\/[^\s]+)/)?.[1]
            if (url)
                await waitFor(async () => {
                    try {
                        await fetch(url + '/api/health')
                        return false
                    } catch {
                        return true
                    }
                }, 'Backend listener leaked')
        } finally {
            await f.cleanup()
        }
    }, 20000)
