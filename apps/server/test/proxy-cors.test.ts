import { afterAll, expect, test } from 'bun:test'
import { startTestServer } from './helpers/test-server'

const server = await startTestServer({ proxy: true, prefix: 'llmflow-proxy-cors-' })
afterAll(() => server.stop())

const cors = (response: Response) => ({
    origin: response.headers.get('access-control-allow-origin'),
    headers: response.headers.get('access-control-allow-headers'),
    methods: response.headers.get('access-control-allow-methods'),
})
const allowed = { origin: '*', headers: '*', methods: '*' }

test('every proxy response carries CORS headers, passthrough included', async () => {
    const invalid = {
        method: 'POST',
        body: '{not json',
        headers: { 'content-type': 'application/json' },
    }
    for (const path of [
        '/v1/chat/completions',
        '/passthrough/anthropic/v1/messages',
        '/passthrough/helicone/v1/chat/completions',
    ]) {
        const response = await fetch(server.proxyUrl + path, invalid)
        expect(response.status).toBe(400)
        expect(cors(response)).toEqual(allowed)
    }
    for (const [path, init] of [
        ['/health', {}],
        ['/providers', {}],
        ['/passthrough/gemini/v1beta/models', { method: 'OPTIONS' }],
    ] as const) {
        const response = await fetch(server.proxyUrl + path, init)
        expect(response.ok).toBe(true)
        expect(cors(response)).toEqual(allowed)
    }
})

test('/providers lists a passthrough prefix for every handler', async () => {
    const body = (await (await fetch(server.proxyUrl + '/providers')).json()) as {
        passthrough: { prefix: string }[]
    }
    expect(body.passthrough.map((entry) => entry.prefix).sort()).toEqual([
        '/passthrough/anthropic/*',
        '/passthrough/gemini/*',
        '/passthrough/helicone/*',
        '/passthrough/openai/*',
    ])
})
