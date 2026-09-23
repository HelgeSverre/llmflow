import { describe, expect, test } from 'bun:test'
import {
    PassthroughHandler,
    AnthropicPassthrough,
    GeminiPassthrough,
    OpenAIPassthrough,
} from './passthrough'

describe('Base PassthroughHandler', () => {
    test('creates handler with default options', () => {
        const handler = new PassthroughHandler({
            name: 'test',
            targetHost: 'api.example.com',
        })

        expect(handler.name).toBe('test')
        expect(handler.targetHost).toBe('api.example.com')
        expect(handler.targetPort).toBe(443)
        expect(handler.protocol).toBe('https')
    })

    test('getTarget preserves original path', () => {
        const handler = new PassthroughHandler({
            targetHost: 'api.example.com',
        })

        const target = handler.getTarget({ path: '/v1/messages' })

        expect(target.hostname).toBe('api.example.com')
        expect(target.port).toBe(443)
        expect(target.path).toBe('/v1/messages')
    })

    test('isStreamingRequest detects stream=true', () => {
        const handler = new PassthroughHandler({ targetHost: 'api.example.com' })

        expect(handler.isStreamingRequest({ body: { stream: true } })).toBe(true)
        expect(handler.isStreamingRequest({ body: { stream: false } })).toBeFalsy()
        expect(handler.isStreamingRequest({ body: {} })).toBeFalsy()
    })
})

describe('AnthropicPassthrough', () => {
    test('AnthropicPassthrough has correct target host', () => {
        const handler = new AnthropicPassthrough()

        expect(handler.name).toBe('anthropic-passthrough')
        expect(handler.targetHost).toBe('api.anthropic.com')
    })

    test('AnthropicPassthrough getTarget preserves path', () => {
        const handler = new AnthropicPassthrough()
        const target = handler.getTarget({ path: '/v1/messages' })

        expect(target.hostname).toBe('api.anthropic.com')
        expect(target.path).toBe('/v1/messages')
    })

    test('AnthropicPassthrough transforms headers with x-api-key', () => {
        const handler = new AnthropicPassthrough()

        const headers = handler.defaultHeaderTransform({
            'x-api-key': 'my-api-key',
            'anthropic-version': '2024-01-01',
        })

        expect(headers['x-api-key']).toBe('my-api-key')
        expect(headers['anthropic-version']).toBe('2024-01-01')
        expect(headers['Content-Type']).toBe('application/json')
    })

    test('AnthropicPassthrough transforms headers with Authorization Bearer', () => {
        const handler = new AnthropicPassthrough()

        const headers = handler.defaultHeaderTransform({
            authorization: 'Bearer my-bearer-key',
        })

        expect(headers['x-api-key']).toBe('my-bearer-key')
        expect(headers['anthropic-version']).toBe('2023-06-01') // default
    })

    test('AnthropicPassthrough passes through anthropic-beta header', () => {
        const handler = new AnthropicPassthrough()

        const headers = handler.defaultHeaderTransform({
            'x-api-key': 'key',
            'anthropic-beta': 'prompt-caching-2024-07-31',
        })

        expect(headers['anthropic-beta']).toBe('prompt-caching-2024-07-31')
    })

    test('AnthropicPassthrough extracts usage from native response', () => {
        const handler = new AnthropicPassthrough()

        const response = {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-3-haiku-20240307',
            stop_reason: 'end_turn',
            usage: {
                input_tokens: 15,
                output_tokens: 8,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 10,
            },
        }

        const usage = handler.defaultExtractUsage(response)

        expect(usage.prompt_tokens).toBe(15)
        expect(usage.completion_tokens).toBe(8)
        expect(usage.total_tokens).toBe(23)
        expect(usage.cache_creation_input_tokens).toBe(0)
        expect(usage.cache_read_input_tokens).toBe(10)
    })

    test('AnthropicPassthrough identifies model from response', () => {
        const handler = new AnthropicPassthrough()

        const model = handler.defaultIdentifyModel(
            { model: 'claude-3-haiku-20240307' },
            { model: 'claude-3-5-haiku-20241022' },
        )

        expect(model).toBe('claude-3-5-haiku-20241022') // prefers response model
    })

    test('AnthropicPassthrough parses streaming content_block_delta', () => {
        const handler = new AnthropicPassthrough()

        const chunk = `event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}

`

        const parsed = parseStream(handler, chunk)

        expect(parsed.content).toBe('Hello World')
        expect(parsed.done).toBe(false)
    })

    test('AnthropicPassthrough parses streaming message_stop', () => {
        const handler = new AnthropicPassthrough()

        const chunk = `event: message_stop
data: {"type":"message_stop"}

`

        const parsed = parseStream(handler, chunk)

        expect(parsed.done).toBe(true)
    })

    test('AnthropicPassthrough parses streaming usage from message_delta', () => {
        const handler = new AnthropicPassthrough()

        const chunk = `event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}

`

        const parsed = parseStream(handler, chunk)

        expect(parsed.usage.completion_tokens).toBe(42)
    })

    test('AnthropicPassthrough parses streaming usage from message_start', () => {
        const handler = new AnthropicPassthrough()

        const chunk = `event: message_start
data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude-3-haiku-20240307","content":[],"usage":{"input_tokens":25}}}

`

        const parsed = parseStream(handler, chunk)

        expect(parsed.usage.prompt_tokens).toBe(25)
    })
})

describe('GeminiPassthrough', () => {
    test('GeminiPassthrough has correct target host', () => {
        const handler = new GeminiPassthrough()

        expect(handler.name).toBe('gemini-passthrough')
        expect(handler.targetHost).toBe('generativelanguage.googleapis.com')
    })

    test('GeminiPassthrough adds API key to query string', () => {
        const handler = new GeminiPassthrough()

        const target = handler.getTarget({
            path: '/v1beta/models/gemini-pro:generateContent',
            headers: { 'x-goog-api-key': 'my-api-key' },
        })

        expect(target.hostname).toBe('generativelanguage.googleapis.com')
        expect(target.path).toContain('key=my-api-key')
    })

    test('GeminiPassthrough extracts API key from Authorization header', () => {
        const handler = new GeminiPassthrough()

        const key = handler.extractApiKey({ authorization: 'Bearer gemini-key' })
        expect(key).toBe('gemini-key')
    })

    test('GeminiPassthrough extracts API key from x-goog-api-key header', () => {
        const handler = new GeminiPassthrough()

        const key = handler.extractApiKey({ 'x-goog-api-key': 'direct-key' })
        expect(key).toBe('direct-key')
    })

    test('GeminiPassthrough extracts usage from native response', () => {
        const handler = new GeminiPassthrough()

        const response = {
            candidates: [
                {
                    content: { parts: [{ text: 'Hello!' }], role: 'model' },
                    finishReason: 'STOP',
                },
            ],
            usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 5,
                totalTokenCount: 15,
            },
        }

        const usage = handler.defaultExtractUsage(response)

        expect(usage.prompt_tokens).toBe(10)
        expect(usage.completion_tokens).toBe(5)
        expect(usage.total_tokens).toBe(15)
    })

    test('GeminiPassthrough parses JSON streaming response', () => {
        const handler = new GeminiPassthrough()

        const chunk = JSON.stringify({
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
        })

        const parsed = parseStream(handler, chunk)

        expect(parsed.content).toBe('Hello World')
        expect(parsed.done).toBe(true)
        expect(parsed.usage.prompt_tokens).toBe(10)
    })
})

describe('OpenAIPassthrough', () => {
    test('OpenAIPassthrough has correct target host', () => {
        const handler = new OpenAIPassthrough()

        expect(handler.name).toBe('openai-passthrough')
        expect(handler.targetHost).toBe('api.openai.com')
    })

    test('OpenAIPassthrough transforms headers correctly', () => {
        const handler = new OpenAIPassthrough()

        const headers = handler.defaultHeaderTransform({
            authorization: 'Bearer sk-test123',
        })

        expect(headers['Authorization']).toBe('Bearer sk-test123')
        expect(headers['Content-Type']).toBe('application/json')
    })

    test('OpenAIPassthrough extracts usage from response', () => {
        const handler = new OpenAIPassthrough()

        const response = {
            id: 'chatcmpl-123',
            model: 'gpt-4o-mini',
            choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        }

        const usage = handler.defaultExtractUsage(response)

        expect(usage.prompt_tokens).toBe(10)
        expect(usage.completion_tokens).toBe(5)
        expect(usage.total_tokens).toBe(15)
    })

    test('OpenAIPassthrough extracts usage from Responses API format', () => {
        const handler = new OpenAIPassthrough()

        const response = {
            id: 'resp-123',
            model: 'gpt-4.1',
            usage: {
                input_tokens: 100,
                output_tokens: 50,
                total_tokens: 150,
            },
        }

        const usage = handler.defaultExtractUsage(response)

        expect(usage.prompt_tokens).toBe(100)
        expect(usage.completion_tokens).toBe(50)
        expect(usage.total_tokens).toBe(150)
    })

    test('OpenAIPassthrough parses streaming chunks', () => {
        const handler = new OpenAIPassthrough()

        const chunk = `data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"chatcmpl-123","choices":[{"delta":{"content":" World"}}]}

`

        const parsed = parseStream(handler, chunk)

        expect(parsed.content).toBe('Hello World')
        expect(parsed.done).toBe(false)
    })

    test('OpenAIPassthrough detects [DONE] in stream', () => {
        const handler = new OpenAIPassthrough()

        const chunk = `data: [DONE]

`

        const parsed = parseStream(handler, chunk)

        expect(parsed.done).toBe(true)
    })
})

function parseStream(handler, chunk) {
    const session = handler.createStreamSession({ path: '/', headers: {}, body: {} }, 'fixture')
    session.push(new TextEncoder().encode(chunk), true)
    return { content: session.content, usage: session.usage, done: session.done }
}
