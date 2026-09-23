import { test, expect } from 'bun:test'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { childEnv, isolatedEnv, tempDirectory } from './helpers/test-server'

async function start(extra: Record<string, string>) {
    const directory = tempDirectory('llmflow-shutdown-')
    const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../src/server.ts')], {
        env: childEnv(isolatedEnv(directory, { OTLP_EXPORT_FLUSH_INTERVAL: '60000', ...extra })),
        stdout: 'pipe',
        stderr: 'pipe',
    })
    let output = ''
    const read = (async () => {
        for await (const chunk of child.stdout) output += new TextDecoder().decode(chunk)
    })()
    const errors = new Response(child.stderr).text()
    const deadline = Date.now() + 5000
    while (!output.match(/Dashboard: (http:\/\/[^\s]+)/) && Date.now() < deadline)
        await Bun.sleep(20)
    const url = output.match(/Dashboard: (http:\/\/[^\s]+)/)?.[1]
    if (!url) {
        child.kill('SIGKILL')
        throw new Error('Server did not start: ' + (await errors))
    }
    return {
        child,
        url,
        async cleanup() {
            child.kill('SIGKILL')
            await child.exited
            await read
            await errors
            rmSync(directory, { recursive: true, force: true })
        },
    }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    test(`${signal} exports the last queued record before exit`, async () => {
        let payload: any = null
        const collector = Bun.serve({
            port: 0,
            hostname: '127.0.0.1',
            async fetch(request) {
                payload = await request.json()
                return Response.json({})
            },
        })
        const server = await start({
            OTLP_EXPORT_TRACES_ENDPOINT: new URL('/v1/traces', collector.url).href,
        })
        try {
            await fetch(new URL('/api/spans', server.url), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    id: 'shutdown-final',
                    span_name: 'last queued record',
                    duration_ms: 0,
                }),
            })
            expect(payload).toBeNull()
            server.child.kill(signal)
            expect(await server.child.exited).toBe(0)
            expect(JSON.stringify(payload)).toContain('last queued record')
        } finally {
            await server.cleanup()
            collector.stop(true)
        }
    }, 10000)
}

test('a stalled collector cannot block shutdown and a second signal exits promptly', async () => {
    const collector = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        fetch() {
            return new Promise<Response>(() => {})
        },
    })
    try {
        for (const repeat of [false, true]) {
            const server = await start({
                OTLP_EXPORT_TRACES_ENDPOINT: new URL('/v1/traces', collector.url).href,
            })
            try {
                await fetch(new URL('/api/spans', server.url), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: '{"id":"pending"}',
                })
                const started = Date.now()
                server.child.kill('SIGTERM')
                if (repeat) {
                    await Bun.sleep(100)
                    server.child.kill('SIGINT')
                }
                expect(await server.child.exited).toBe(0)
                expect(Date.now() - started).toBeLessThan(repeat ? 2000 : 6500)
            } finally {
                await server.cleanup()
            }
        }
    } finally {
        collector.stop(true)
    }
}, 15000)

test('stopping without export requires no configuration', async () => {
    const server = await start({})
    try {
        server.child.kill('SIGINT')
        expect(await server.child.exited).toBe(0)
    } finally {
        await server.cleanup()
    }
})
