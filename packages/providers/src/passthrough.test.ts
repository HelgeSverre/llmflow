// Passthrough mode: the registry's providers forward native requests unchanged.
import { describe, expect, test } from 'bun:test'
import { apiKeyFrom, type BaseProvider, type ProviderRequest } from './base'
import { GeminiProvider, HeliconeProvider, passthroughProviders, registry } from './index'

const request = (fields: Partial<ProviderRequest> = {}): ProviderRequest => ({
    path: '/',
    headers: {},
    ...fields,
})

function parseStream(provider: BaseProvider, chunk: string) {
    const session = provider.createStreamSession(request({ body: {} }), 'fixture')
    session.push(new TextEncoder().encode(chunk), true)
    return { content: session.content, usage: session.usage, done: session.done }
}

describe('passthrough routes', () => {
    test('reuse the translated-route provider instances, so both modes share a provider name', () => {
        expect(passthroughProviders.anthropic).toBe(registry.get('anthropic')!)
        expect(passthroughProviders.gemini).toBe(registry.get('gemini')!)
        expect(passthroughProviders.openai).toBe(registry.get('openai')!)
        expect(Object.values(passthroughProviders).map((p) => p.name)).toEqual([
            'anthropic',
            'gemini',
            'openai',
            'helicone',
        ])
    })

    test('keep the client path and host', () => {
        for (const [provider, host] of [
            [passthroughProviders.anthropic!, 'api.anthropic.com'],
            [passthroughProviders.openai!, 'api.openai.com'],
        ] as const)
            expect(provider.passthroughTarget(request({ path: '/v1/messages?x=1' }))).toEqual({
                hostname: host,
                port: 443,
                path: '/v1/messages?x=1',
                protocol: 'https',
            })
    })

    test('detect streaming from the body', () => {
        const provider = passthroughProviders.openai!
        expect(provider.isStreamingRequest(request({ body: { stream: true } }))).toBe(true)
        expect(provider.isStreamingRequest(request({ body: { stream: false } }))).toBe(false)
        expect(provider.isStreamingRequest(request({ body: {} }))).toBe(false)
    })
})

describe('apiKeyFrom', () => {
    test('prefers the named headers, then strips Bearer from Authorization', () => {
        expect(
            apiKeyFrom({ 'x-api-key': 'direct', authorization: 'Bearer other' }, 'x-api-key'),
        ).toBe('direct')
        expect(apiKeyFrom({ authorization: 'Bearer sk-1' }, 'x-api-key')).toBe('sk-1')
        expect(apiKeyFrom({ authorization: 'bearer sk-2' })).toBe('sk-2')
        expect(apiKeyFrom({}, 'x-api-key')).toBeUndefined()
        expect(apiKeyFrom(undefined)).toBeUndefined()
    })
})

describe('Anthropic', () => {
    const provider = passthroughProviders.anthropic!

    test('sends the key as x-api-key from either header', () => {
        expect(
            provider.transformRequestHeaders({ 'x-api-key': 'sk-ant-direct' })['x-api-key'],
        ).toBe('sk-ant-direct')
        expect(
            provider.transformRequestHeaders({ authorization: 'Bearer sk-ant-bearer' })[
                'x-api-key'
            ],
        ).toBe('sk-ant-bearer')
    })

    test('keeps the client anthropic-version and anthropic-beta', () => {
        const headers = provider.transformRequestHeaders({
            'x-api-key': 'k',
            'anthropic-version': '2024-01-01',
            'anthropic-beta': 'prompt-caching-2024-07-31',
        })
        expect(headers['anthropic-version']).toBe('2024-01-01')
        expect(headers['anthropic-beta']).toBe('prompt-caching-2024-07-31')
        expect(provider.transformRequestHeaders({ 'x-api-key': 'k' })['anthropic-version']).toBe(
            '2023-06-01',
        )
    })

    test('extracts usage, including prompt-cache counters, from a native response', () => {
        const usage = provider.extractUsage({
            model: 'claude-3-haiku-20240307',
            usage: {
                input_tokens: 15,
                output_tokens: 8,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 10,
            },
        })
        expect(usage).toEqual({
            prompt_tokens: 15,
            completion_tokens: 8,
            total_tokens: 23,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 10,
        })
    })

    test('prefers the response model over the requested one', () => {
        expect(
            provider.responseModel(
                { model: 'claude-3-5-haiku-20241022' },
                request({ body: { model: 'claude-3-haiku-20240307' } }),
            ),
        ).toBe('claude-3-5-haiku-20241022')
        expect(provider.responseModel({}, request({ body: { model: 'claude-x' } }))).toBe(
            'claude-x',
        )
    })

    test('parses streaming text, stop and usage events', () => {
        expect(
            parseStream(
                provider,
                'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}\n\n',
            ),
        ).toMatchObject({ content: 'Hello World', done: false })
        expect(
            parseStream(provider, 'event: message_stop\ndata: {"type":"message_stop"}\n\n').done,
        ).toBe(true)
        expect(
            parseStream(
                provider,
                'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}\n\n',
            ).usage.completion_tokens,
        ).toBe(42)
        expect(
            parseStream(
                provider,
                'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","model":"claude-3-haiku-20240307","content":[],"usage":{"input_tokens":25}}}\n\n',
            ).usage.prompt_tokens,
        ).toBe(25)
    })
})

describe('Gemini', () => {
    const provider = passthroughProviders.gemini as GeminiProvider

    test('moves the API key into the query string', () => {
        const target = provider.passthroughTarget(
            request({
                path: '/v1beta/models/gemini-pro:generateContent',
                headers: { 'x-goog-api-key': 'my-api-key' },
            }),
        )
        expect(target.hostname).toBe('generativelanguage.googleapis.com')
        expect(target.path).toBe('/v1beta/models/gemini-pro:generateContent?key=my-api-key')
        expect(provider.transformRequestHeaders({ authorization: 'Bearer k' })).toEqual({
            'Content-Type': 'application/json',
        })
    })

    test('reads the key from x-goog-api-key or Authorization', () => {
        expect(provider.extractApiKey({ authorization: 'Bearer gemini-key' })).toBe('gemini-key')
        expect(provider.extractApiKey({ 'x-goog-api-key': 'direct-key' })).toBe('direct-key')
    })

    test('reads the model and streaming from a native path', () => {
        const streaming = request({
            path: '/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse',
        })
        expect(provider.isStreamingRequest(streaming)).toBe(true)
        expect(provider.identifyRequestModel(streaming)).toBe('gemini-2.5-pro')
        expect(
            provider.isStreamingRequest(request({ path: '/v1beta/models/x:generateContent' })),
        ).toBe(false)
    })

    test('extracts usage and the served model version from a native response', () => {
        const response = {
            modelVersion: 'gemini-2.5-pro-001',
            candidates: [
                { content: { parts: [{ text: 'Hello!' }], role: 'model' }, finishReason: 'STOP' },
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
        }
        expect(provider.extractUsage(response)).toMatchObject({
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
        })
        expect(provider.responseModel(response, request())).toBe('gemini-2.5-pro-001')
    })

    test('parses a JSON streaming response', () => {
        const parsed = parseStream(
            provider,
            JSON.stringify({
                candidates: [
                    {
                        content: { parts: [{ text: 'Hello World' }], role: 'model' },
                        finishReason: 'STOP',
                    },
                ],
                usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 5,
                    totalTokenCount: 15,
                },
            }),
        )
        expect(parsed).toMatchObject({ content: 'Hello World', done: true })
        expect(parsed.usage.prompt_tokens).toBe(10)
    })
})

describe('OpenAI', () => {
    const provider = passthroughProviders.openai!

    test('forwards Authorization', () => {
        expect(provider.transformRequestHeaders({ authorization: 'Bearer sk-test123' })).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test123',
        })
    })

    test('extracts Chat Completions and Responses API usage', () => {
        expect(
            provider.extractUsage({
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            }),
        ).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })
        expect(
            provider.extractUsage({
                usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
            }),
        ).toEqual({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    })

    test('parses streaming chunks and [DONE]', () => {
        expect(
            parseStream(
                provider,
                'data: {"id":"c","choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"id":"c","choices":[{"delta":{"content":" World"}}]}\n\n',
            ),
        ).toMatchObject({ content: 'Hello World', done: false })
        expect(parseStream(provider, 'data: [DONE]\n\n').done).toBe(true)
    })
})

describe('Helicone', () => {
    const provider = new HeliconeProvider()

    test('targets the Helicone gateway and forwards its feature headers', () => {
        expect(provider.passthroughTarget(request({ path: '/v1/chat/completions' }))).toMatchObject(
            {
                hostname: 'oai.helicone.ai',
                port: 443,
                path: '/v1/chat/completions',
            },
        )
        const headers = provider.transformRequestHeaders({
            authorization: 'Bearer sk-openai',
            'helicone-auth': 'hk-1',
            'helicone-property-team': 'core',
            'x-unrelated': 'dropped',
        })
        expect(headers).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-openai',
            'Helicone-Auth': 'Bearer hk-1',
            'helicone-property-team': 'core',
        })
    })
})
