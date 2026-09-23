import { describe, expect, test } from 'bun:test'
import {
    registry,
    OpenAIProvider,
    OllamaProvider,
    AnthropicProvider,
    GeminiProvider,
    CohereProvider,
    AzureOpenAIProvider,
} from './index'
import type { BaseProvider, ProviderRequest } from './base'

const request = (fields: Partial<ProviderRequest> = {}): ProviderRequest => ({
    path: '/',
    headers: {},
    ...fields,
})

describe('Provider Resolution', () => {
    test('resolves OpenAI as default for /v1/* paths', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/v1/chat/completions',
            headers: {},
        })
        expect(provider.name).toBe('openai')
        expect(cleanPath).toBe('/v1/chat/completions')
    })

    test('resolves Ollama for /ollama/v1/* paths', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/ollama/v1/chat/completions',
            headers: {},
        })
        expect(provider.name).toBe('ollama')
        expect(cleanPath).toBe('/v1/chat/completions')
    })

    test('resolves Anthropic for /anthropic/* paths', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/anthropic/v1/messages',
            headers: {},
        })
        expect(provider.name).toBe('anthropic')
        expect(cleanPath).toBe('/v1/messages')
    })

    test('resolves Groq for /groq/* paths', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/groq/v1/chat/completions',
            headers: {},
        })
        expect(provider.name).toBe('groq')
        expect(cleanPath).toBe('/v1/chat/completions')
    })

    test('resolves provider from X-LLMFlow-Provider header', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/v1/chat/completions',
            headers: { 'x-llmflow-provider': 'anthropic' },
        })
        expect(provider.name).toBe('anthropic')
        expect(cleanPath).toBe('/v1/chat/completions')
    })

    test('header override takes precedence over path', () => {
        const { provider } = registry.resolve({
            path: '/ollama/v1/chat/completions',
            headers: { 'x-llmflow-provider': 'groq' },
        })
        expect(provider.name).toBe('groq')
    })

    test('lists all registered providers', () => {
        const providers = registry.list()
        expect(providers.length).toBeGreaterThanOrEqual(7)

        const names = providers.map((p) => p.name)
        expect(names).toContain('openai')
        expect(names).toContain('ollama')
        expect(names).toContain('anthropic')
        expect(names).toContain('groq')
    })
})

describe('OpenAI Provider', () => {
    test('OpenAI getTarget returns correct hostname and path', () => {
        const provider = new OpenAIProvider()
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('api.openai.com')
        expect(target.port).toBe(443)
        expect(target.path).toBe('/v1/chat/completions')
    })

    test('OpenAI transforms headers correctly', () => {
        const provider = new OpenAIProvider()
        const headers = provider.transformRequestHeaders(
            { authorization: 'Bearer sk-test123' },
            request(),
        )

        expect(headers['Content-Type']).toBe('application/json')
        expect(headers['Authorization']).toBe('Bearer sk-test123')
    })

    test('OpenAI detects Responses API path', () => {
        const provider = new OpenAIProvider()
        expect(provider.isResponsesAPI(request({ path: '/v1/responses' }))).toBe(true)
        expect(provider.isResponsesAPI(request({ path: '/v1/chat/completions' }))).toBeFalsy()
    })

    test('OpenAI normalizes Chat Completions response', () => {
        const provider = new OpenAIProvider()
        const response = {
            id: 'chatcmpl-123',
            model: 'gpt-4',
            choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }

        const normalized = provider.normalizeResponse(
            response,
            request({
                path: '/v1/chat/completions',
                body: {},
            }),
        )
        expect(normalized.model).toBe('gpt-4')
        expect(normalized.usage!.prompt_tokens).toBe(10)
        expect(normalized.usage!.completion_tokens).toBe(5)
    })

    test('OpenAI normalizes Responses API response', () => {
        const provider = new OpenAIProvider()
        const response = {
            id: 'resp-123',
            model: 'gpt-4.1',
            output: [
                {
                    type: 'message',
                    content: [{ type: 'output_text', text: 'Hello!' }],
                },
            ],
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        }

        const normalized = provider.normalizeResponse(
            response,
            request({ path: '/v1/responses', body: {} }),
        )
        expect(normalized.model).toBe('gpt-4.1')
        expect(normalized.usage!.prompt_tokens).toBe(10)
        expect(normalized.usage!.completion_tokens).toBe(5)
        expect(normalized._extractedContent).toBe('Hello!')
    })

    test('OpenAI extracts usage from Chat Completions format', () => {
        const provider = new OpenAIProvider()
        const usage = provider.extractUsage({
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        })

        expect(usage.prompt_tokens).toBe(100)
        expect(usage.completion_tokens).toBe(50)
        expect(usage.total_tokens).toBe(150)
    })

    test('OpenAI extracts usage from Responses API format', () => {
        const provider = new OpenAIProvider()
        const usage = provider.extractUsage({
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
        })

        expect(usage.prompt_tokens).toBe(100)
        expect(usage.completion_tokens).toBe(50)
        expect(usage.total_tokens).toBe(150)
    })

    test('OpenAI parses streaming chunks', () => {
        const provider = new OpenAIProvider()
        const chunk =
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" World"}}]}\n\n'

        const parsed = parseStream(provider, chunk)
        expect(parsed.content).toBe('Hello World')
        expect(parsed.done).toBe(false)
    })

    test('OpenAI detects [DONE] in stream', () => {
        const provider = new OpenAIProvider()
        const chunk = 'data: [DONE]\n\n'

        const parsed = parseStream(provider, chunk)
        expect(parsed.done).toBe(true)
    })
})

describe('Ollama Provider', () => {
    test('Ollama uses HTTP module', () => {
        const provider = new OllamaProvider()
        expect(provider.getTarget(request({ path: '/v1/chat/completions' })).protocol).toBe('http')
    })

    test('Ollama uses correct default host and port', () => {
        const provider = new OllamaProvider()
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('localhost')
        expect(target.port).toBe(11434)
        expect(target.protocol).toBe('http')
    })

    test('Ollama does not require authorization header', () => {
        const provider = new OllamaProvider()
        const headers = provider.transformRequestHeaders({}, request())

        expect(headers['Content-Type']).toBe('application/json')
        expect(headers['Authorization']).toBeFalsy()
    })
})

describe('Anthropic Provider', () => {
    test('Anthropic maps /v1/chat/completions to /v1/messages', () => {
        const provider = new AnthropicProvider()
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.path).toBe('/v1/messages')
        expect(target.hostname).toBe('api.anthropic.com')
    })

    test('Anthropic transforms headers with x-api-key', () => {
        const provider = new AnthropicProvider()
        const headers = provider.transformRequestHeaders(
            { authorization: 'Bearer sk-ant-test123' },
            request(),
        )

        expect(headers['x-api-key']).toBe('sk-ant-test123')
        expect(headers['anthropic-version']).toBe('2023-06-01')
        expect(headers['Content-Type']).toBe('application/json')
        expect(headers['Authorization']).toBeFalsy()
    })

    test('Anthropic accepts x-api-key header directly', () => {
        const provider = new AnthropicProvider()
        const headers = provider.transformRequestHeaders({ 'x-api-key': 'direct-key' }, request())

        expect(headers['x-api-key']).toBe('direct-key')
    })

    test('Anthropic transforms request body - extracts system message', () => {
        const provider = new AnthropicProvider()
        const body = {
            model: 'claude-3-haiku',
            messages: [
                { role: 'system', content: 'You are helpful' },
                { role: 'user', content: 'Hello' },
            ],
        }

        const transformed = provider.transformRequestBody(body, request()) as Record<string, any>

        expect(transformed.system).toBe('You are helpful')
        expect(transformed.messages.length).toBe(1)
        expect(transformed.messages[0].role).toBe('user')
        expect(transformed.messages[0].content).toBe('Hello')
        expect(transformed.max_tokens).toBe(4096)
    })

    test('Anthropic preserves max_tokens if provided', () => {
        const provider = new AnthropicProvider()
        const body = {
            model: 'claude-3-haiku',
            max_tokens: 1000,
            messages: [{ role: 'user', content: 'Hello' }],
        }

        const transformed = provider.transformRequestBody(body, request()) as Record<string, any>
        expect(transformed.max_tokens).toBe(1000)
    })

    test('Anthropic transforms stop to stop_sequences', () => {
        const provider = new AnthropicProvider()
        const body = {
            model: 'claude-3-haiku',
            messages: [{ role: 'user', content: 'Hello' }],
            stop: 'END',
        }

        const transformed = provider.transformRequestBody(body, request()) as Record<string, any>
        expect(transformed.stop_sequences).toEqual(['END'])
    })

    test('Anthropic normalizes response to OpenAI format', () => {
        const provider = new AnthropicProvider()
        const anthropicResponse = {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-haiku',
            content: [{ type: 'text', text: 'Hello there!' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
        }

        const normalized = provider.normalizeResponse(anthropicResponse, request({ body: {} }))

        expect(normalized.model).toBe('claude-3-haiku')
        expect((normalized.data as Record<string, any>).choices[0].message.content).toBe(
            'Hello there!',
        )
        expect((normalized.data as Record<string, any>).choices[0].finish_reason).toBe('stop')
        expect(normalized.usage!.prompt_tokens).toBe(10)
        expect(normalized.usage!.completion_tokens).toBe(5)
        expect(normalized.usage!.total_tokens).toBe(15)
    })

    test('Anthropic parses streaming chunks', () => {
        const provider = new AnthropicProvider()
        const chunk = `event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}

`

        const parsed = parseStream(provider, chunk)
        expect(parsed.content).toBe('Hello World')
    })

    test('Anthropic detects message_stop event', () => {
        const provider = new AnthropicProvider()
        const chunk = `event: message_stop
data: {"type":"message_stop"}

`

        const parsed = parseStream(provider, chunk)
        expect(parsed.done).toBe(true)
    })
})

describe('Gemini Provider', () => {
    test('Gemini resolves for /gemini/* paths', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/gemini/v1/chat/completions',
            headers: {},
        })
        expect(provider.name).toBe('gemini')
        expect(cleanPath).toBe('/v1/chat/completions')
    })

    test('Gemini getTarget builds correct endpoint with model', () => {
        const provider = new GeminiProvider()
        const target = provider.getTarget({
            path: '/v1/chat/completions',
            body: { model: 'gemini-2.0-flash' },
            headers: { authorization: 'Bearer test-key' },
        })

        expect(target.hostname).toBe('generativelanguage.googleapis.com')
        expect(target.path).toContain('/v1beta/models/gemini-2.0-flash:generateContent')
        expect(target.path).toContain('key=test-key')
    })

    test('Gemini uses streamGenerateContent for streaming requests', () => {
        const provider = new GeminiProvider()
        const target = provider.getTarget({
            path: '/v1/chat/completions',
            body: { model: 'gemini-2.0-flash', stream: true },
            headers: { authorization: 'Bearer test-key' },
        })

        expect(target.path).toContain(':streamGenerateContent')
    })

    test('Gemini transforms OpenAI messages to contents format', () => {
        const provider = new GeminiProvider()
        const body = {
            model: 'gemini-2.0-flash',
            messages: [
                { role: 'system', content: 'You are helpful' },
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' },
                { role: 'user', content: 'How are you?' },
            ],
            max_tokens: 1000,
            temperature: 0.7,
        }

        const transformed = provider.transformRequestBody(body, request()) as Record<string, any>

        // System message should be in systemInstruction
        expect(transformed.systemInstruction.parts[0].text).toBe('You are helpful')

        // Other messages should be in contents
        expect(transformed.contents.length).toBe(3)
        expect(transformed.contents[0].role).toBe('user')
        expect(transformed.contents[0].parts[0].text).toBe('Hello')
        expect(transformed.contents[1].role).toBe('model') // assistant -> model
        expect(transformed.contents[2].role).toBe('user')

        // Generation config
        expect(transformed.generationConfig.maxOutputTokens).toBe(1000)
        expect(transformed.generationConfig.temperature).toBe(0.7)
    })

    test('Gemini passes through native format', () => {
        const provider = new GeminiProvider()
        const body = {
            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        }

        const transformed = provider.transformRequestBody(body, request()) as Record<string, any>
        expect(transformed).toEqual(body)
    })

    test('Gemini normalizes response to OpenAI format', () => {
        const provider = new GeminiProvider()
        const geminiResponse = {
            candidates: [
                {
                    content: {
                        parts: [{ text: 'Hello there!' }],
                        role: 'model',
                    },
                    finishReason: 'STOP',
                },
            ],
            usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 5,
                totalTokenCount: 15,
            },
        }

        const normalized = provider.normalizeResponse(
            geminiResponse,
            request({
                body: { model: 'gemini-2.0-flash' },
            }),
        )

        expect(normalized.model).toBe('gemini-2.0-flash')
        expect((normalized.data as Record<string, any>).choices[0].message.content).toBe(
            'Hello there!',
        )
        expect((normalized.data as Record<string, any>).choices[0].finish_reason).toBe('stop')
        expect(normalized.usage!.prompt_tokens).toBe(10)
        expect(normalized.usage!.completion_tokens).toBe(5)
        expect(normalized.usage!.total_tokens).toBe(15)
    })

    test('Gemini extracts usage from usageMetadata', () => {
        const provider = new GeminiProvider()
        const usage = provider.extractUsage({
            usageMetadata: {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            },
        })

        expect(usage.prompt_tokens).toBe(100)
        expect(usage.completion_tokens).toBe(50)
        expect(usage.total_tokens).toBe(150)
    })

    test('Gemini extracts API key from Authorization header', () => {
        const provider = new GeminiProvider()
        const key = provider.extractApiKey({ authorization: 'Bearer my-api-key' })
        expect(key).toBe('my-api-key')
    })

    test('Gemini extracts API key from x-goog-api-key header', () => {
        const provider = new GeminiProvider()
        const key = provider.extractApiKey({ 'x-goog-api-key': 'direct-key' })
        expect(key).toBe('direct-key')
    })
})

describe('Cohere Provider', () => {
    test('Cohere resolves for /cohere/* paths', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/cohere/v1/chat/completions',
            headers: {},
        })
        expect(provider.name).toBe('cohere')
        expect(cleanPath).toBe('/v1/chat/completions')
    })

    test('Cohere maps /v1/chat/completions to /v2/chat', () => {
        const provider = new CohereProvider()
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('api.cohere.com')
        expect(target.path).toBe('/v2/chat')
    })

    test('Cohere transforms stop to stop_sequences', () => {
        const provider = new CohereProvider()
        const body = {
            model: 'command',
            messages: [{ role: 'user', content: 'Hello' }],
            stop: 'END',
            top_p: 0.9,
        }

        const transformed = provider.transformRequestBody(body, request()) as Record<string, any>
        expect(transformed.stop_sequences).toEqual(['END'])
        expect(transformed.p).toBe(0.9) // top_p -> p
    })

    test('Cohere normalizes response with nested content array', () => {
        const provider = new CohereProvider()
        const cohereResponse = {
            id: 'resp-123',
            finish_reason: 'COMPLETE',
            message: {
                role: 'assistant',
                content: [{ type: 'text', text: 'Hello there!' }],
            },
            usage: {
                tokens: { input_tokens: 10, output_tokens: 5 },
                billed_units: { input_tokens: 10, output_tokens: 5 },
            },
        }

        const normalized = provider.normalizeResponse(
            cohereResponse,
            request({
                body: { model: 'command' },
            }),
        )

        expect((normalized.data as Record<string, any>).choices[0].message.content).toBe(
            'Hello there!',
        )
        expect((normalized.data as Record<string, any>).choices[0].finish_reason).toBe('stop')
        expect(normalized.usage!.prompt_tokens).toBe(10)
        expect(normalized.usage!.completion_tokens).toBe(5)
    })

    test('Cohere parses streaming content-delta events', () => {
        const provider = new CohereProvider()
        const chunk = `data: {"type":"content-delta","index":0,"delta":{"message":{"content":[{"type":"text","text":"Hello"}]}}}

data: {"type":"content-delta","index":0,"delta":{"message":{"content":[{"type":"text","text":" World"}]}}}

`

        const parsed = parseStream(provider, chunk)
        expect(parsed.content).toBe('Hello World')
    })

    test('Cohere detects message-end event with usage', () => {
        const provider = new CohereProvider()
        const chunk = `data: {"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"tokens":{"input_tokens":10,"output_tokens":5}}}}

`

        const parsed = parseStream(provider, chunk)
        expect(parsed.done).toBe(true)
        expect(parsed.usage.prompt_tokens).toBe(10)
        expect(parsed.usage.completion_tokens).toBe(5)
    })
})

describe('Azure OpenAI Provider', () => {
    test('Azure resolves for /azure/* paths', () => {
        const { provider, cleanPath } = registry.resolve({
            path: '/azure/v1/chat/completions',
            headers: {},
        })
        expect(provider.name).toBe('azure')
        expect(cleanPath).toBe('/v1/chat/completions')
    })

    test('Azure builds correct endpoint with deployment name', () => {
        const provider = new AzureOpenAIProvider({ resource: 'my-resource' })
        const target = provider.getTarget({
            path: '/v1/chat/completions',
            body: { model: 'gpt-4' },
            headers: {},
        })

        expect(target.hostname).toBe('my-resource.openai.azure.com')
        expect(target.path).toContain('/openai/deployments/gpt-4/chat/completions')
        expect(target.path).toContain('api-version=')
    })

    test('Azure converts model with dots to deployment name', () => {
        const provider = new AzureOpenAIProvider({ resource: 'test' })
        const deployment = provider.getDeploymentName('gpt-3.5-turbo')
        expect(deployment).toBe('gpt-35-turbo')
    })

    test('Azure transforms Authorization Bearer to api-key header', () => {
        const provider = new AzureOpenAIProvider()
        const headers = provider.transformRequestHeaders(
            { authorization: 'Bearer my-azure-key' },
            request(),
        )

        expect(headers['api-key']).toBe('my-azure-key')
        expect(headers['Authorization']).toBeFalsy()
    })

    test('Azure uses api-key header directly if provided', () => {
        const provider = new AzureOpenAIProvider()
        const headers = provider.transformRequestHeaders({ 'api-key': 'direct-key' }, request())

        expect(headers['api-key']).toBe('direct-key')
    })

    test('Azure allows resource override via header', () => {
        const provider = new AzureOpenAIProvider({ resource: 'default-resource' })
        const resource = provider.getResourceName({ 'x-azure-resource': 'custom-resource' })
        expect(resource).toBe('custom-resource')
    })
})

describe('OpenAI-Compatible Provider', () => {
    test('Groq provider uses correct hostname', () => {
        const { provider } = registry.resolve({ path: '/groq/v1/chat/completions', headers: {} })
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('api.groq.com')
        expect(target.path).toBe('/openai/v1/chat/completions')
    })

    test('Mistral provider uses correct hostname', () => {
        const { provider } = registry.resolve({ path: '/mistral/v1/chat/completions', headers: {} })
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('api.mistral.ai')
        expect(target.path).toBe('/v1/chat/completions')
    })

    test('Together provider uses correct hostname', () => {
        const { provider } = registry.resolve({
            path: '/together/v1/chat/completions',
            headers: {},
        })
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('api.together.xyz')
    })

    test('OpenRouter provider uses correct hostname and base path', () => {
        const { provider } = registry.resolve({
            path: '/openrouter/v1/chat/completions',
            headers: {},
        })
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('openrouter.ai')
        expect(target.path).toBe('/api/v1/chat/completions')
    })

    test('Perplexity provider has no v1 prefix', () => {
        const { provider } = registry.resolve({
            path: '/perplexity/v1/chat/completions',
            headers: {},
        })
        const target = provider.getTarget(request({ path: '/v1/chat/completions' }))

        expect(target.hostname).toBe('api.perplexity.ai')
        expect(target.path).toBe('/v1/chat/completions')
    })
})

describe('Streaming Detection', () => {
    test('detects streaming request from body.stream=true', () => {
        const provider = new OpenAIProvider()
        expect(provider.isStreamingRequest(request({ body: { stream: true } }))).toBe(true)
        expect(provider.isStreamingRequest(request({ body: { stream: false } }))).toBeFalsy()
        expect(provider.isStreamingRequest(request({ body: {} }))).toBeFalsy()
    })
})

function parseStream(
    provider: { createStreamSession: BaseProvider['createStreamSession'] },
    chunk: string,
) {
    const session = provider.createStreamSession({ path: '/', headers: {}, body: {} }, 'fixture')
    session.push(new TextEncoder().encode(chunk), true)
    return { content: session.content, usage: session.usage, done: session.done }
}
