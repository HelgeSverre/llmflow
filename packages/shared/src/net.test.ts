import { afterEach, expect, test } from 'bun:test'
import { clientHost, clientUrl, freePort, parsePort, waitForHealth, waitUntil } from './net'

afterEach(() => {
    delete process.env.NET_TEST_PORT
})

test('parsePort reads the environment and rejects invalid ports', () => {
    expect(parsePort('NET_TEST_PORT', 1337)).toBe(1337)
    process.env.NET_TEST_PORT = '0'
    expect(parsePort('NET_TEST_PORT', 1337)).toBe(0)
    for (const value of ['-1', '65536', '1.5', 'x']) {
        process.env.NET_TEST_PORT = value
        expect(() => parsePort('NET_TEST_PORT', 1337)).toThrow('NET_TEST_PORT must be a port')
    }
})

test('clientHost and clientUrl turn wildcard binds into loopback and bracket IPv6', () => {
    expect(clientHost('0.0.0.0')).toBe('127.0.0.1')
    expect(clientHost('::')).toBe('127.0.0.1')
    expect(clientHost('::1')).toBe('[::1]')
    expect(clientHost('[::1]')).toBe('[::1]')
    expect(clientHost('example.test')).toBe('example.test')
    expect(clientUrl('http://0.0.0.0:1337/')).toBe('http://127.0.0.1:1337')
    expect(clientUrl(new URL('http://[::]:8080/x'))).toBe('http://127.0.0.1:8080')
})

test('freePort returns a bindable port', async () => {
    const port = await freePort()
    const server = Bun.serve({ hostname: '127.0.0.1', port, fetch: () => new Response() })
    expect(server.port).toBe(port)
    await server.stop(true)
})

test('waitUntil resolves with the first truthy value and times out otherwise', async () => {
    let calls = 0
    expect(await waitUntil(() => ++calls >= 3 && 'done', 'never', 1000, 1)).toBe('done')
    await expect(waitUntil(() => false, 'gave up', 30, 5)).rejects.toThrow('gave up')
})

test('waitForHealth waits for /api/health to answer', async () => {
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch: (request) =>
            new URL(request.url).pathname === '/api/health'
                ? Response.json({ status: 'ok' })
                : new Response(null, { status: 404 }),
    })
    try {
        expect(await waitForHealth(server.url.origin, 1000)).toBe(true)
    } finally {
        await server.stop(true)
    }
    await expect(waitForHealth('http://127.0.0.1:1', 200)).rejects.toThrow('did not become healthy')
})
