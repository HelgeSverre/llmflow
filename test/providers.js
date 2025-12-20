#!/usr/bin/env node

/**
 * Provider Unit Tests
 * 
 * Tests provider resolution, request transformation, and response normalization.
 * No real API calls - tests the transformation logic only.
 */

const { registry, OpenAIProvider, OllamaProvider, AnthropicProvider, GeminiProvider, CohereProvider, AzureOpenAIProvider, OpenAICompatibleProvider } = require('../providers');

const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    dim: '\x1b[2m',
};

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`${c.green}✓${c.reset} ${name}`);
        passed++;
    } catch (err) {
        console.log(`${c.red}✗${c.reset} ${name}`);
        console.log(`  ${c.red}${err.message}${c.reset}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Expected'}: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message || 'Expected'}: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
    }
}

// ============ Provider Resolution Tests ============

console.log(`\n${c.cyan}Provider Resolution${c.reset}\n`);

test('resolves OpenAI as default for /v1/* paths', () => {
    const { provider, cleanPath } = registry.resolve({ path: '/v1/chat/completions', headers: {} });
    assertEqual(provider.name, 'openai');
    assertEqual(cleanPath, '/v1/chat/completions');
});

test('resolves Ollama for /ollama/v1/* paths', () => {
    const { provider, cleanPath } = registry.resolve({ path: '/ollama/v1/chat/completions', headers: {} });
    assertEqual(provider.name, 'ollama');
    assertEqual(cleanPath, '/v1/chat/completions');
});

test('resolves Anthropic for /anthropic/* paths', () => {
    const { provider, cleanPath } = registry.resolve({ path: '/anthropic/v1/messages', headers: {} });
    assertEqual(provider.name, 'anthropic');
    assertEqual(cleanPath, '/v1/messages');
});

test('resolves Groq for /groq/* paths', () => {
    const { provider, cleanPath } = registry.resolve({ path: '/groq/v1/chat/completions', headers: {} });
    assertEqual(provider.name, 'groq');
    assertEqual(cleanPath, '/v1/chat/completions');
});

test('resolves provider from X-LLMFlow-Provider header', () => {
    const { provider, cleanPath } = registry.resolve({
        path: '/v1/chat/completions',
        headers: { 'x-llmflow-provider': 'anthropic' }
    });
    assertEqual(provider.name, 'anthropic');
    assertEqual(cleanPath, '/v1/chat/completions');
});

test('header override takes precedence over path', () => {
    const { provider } = registry.resolve({
        path: '/ollama/v1/chat/completions',
        headers: { 'x-llmflow-provider': 'groq' }
    });
    assertEqual(provider.name, 'groq');
});

test('lists all registered providers', () => {
    const providers = registry.list();
    assert(providers.length >= 7, 'Should have at least 7 providers');
    
    const names = providers.map(p => p.name);
    assert(names.includes('openai'), 'Should include openai');
    assert(names.includes('ollama'), 'Should include ollama');
    assert(names.includes('anthropic'), 'Should include anthropic');
    assert(names.includes('groq'), 'Should include groq');
});

// ============ OpenAI Provider Tests ============

console.log(`\n${c.cyan}OpenAI Provider${c.reset}\n`);

test('OpenAI getTarget returns correct hostname and path', () => {
    const provider = new OpenAIProvider();
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'api.openai.com');
    assertEqual(target.port, 443);
    assertEqual(target.path, '/v1/chat/completions');
});

test('OpenAI transforms headers correctly', () => {
    const provider = new OpenAIProvider();
    const headers = provider.transformRequestHeaders(
        { authorization: 'Bearer sk-test123' },
        {}
    );
    
    assertEqual(headers['Content-Type'], 'application/json');
    assertEqual(headers['Authorization'], 'Bearer sk-test123');
});

test('OpenAI detects Responses API path', () => {
    const provider = new OpenAIProvider();
    assert(provider.isResponsesAPI({ path: '/v1/responses' }), 'Should detect /v1/responses');
    assert(!provider.isResponsesAPI({ path: '/v1/chat/completions' }), 'Should not detect /v1/chat/completions');
});

test('OpenAI normalizes Chat Completions response', () => {
    const provider = new OpenAIProvider();
    const response = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    };
    
    const normalized = provider.normalizeResponse(response, { path: '/v1/chat/completions', body: {} });
    assertEqual(normalized.model, 'gpt-4');
    assertEqual(normalized.usage.prompt_tokens, 10);
    assertEqual(normalized.usage.completion_tokens, 5);
});

test('OpenAI normalizes Responses API response', () => {
    const provider = new OpenAIProvider();
    const response = {
        id: 'resp-123',
        model: 'gpt-4.1',
        output: [{
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello!' }]
        }],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
    };
    
    const normalized = provider.normalizeResponse(response, { path: '/v1/responses', body: {} });
    assertEqual(normalized.model, 'gpt-4.1');
    assertEqual(normalized.usage.prompt_tokens, 10);
    assertEqual(normalized.usage.completion_tokens, 5);
    assertEqual(normalized._extractedContent, 'Hello!');
});

test('OpenAI extracts usage from Chat Completions format', () => {
    const provider = new OpenAIProvider();
    const usage = provider.extractUsage({
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });
    
    assertEqual(usage.prompt_tokens, 100);
    assertEqual(usage.completion_tokens, 50);
    assertEqual(usage.total_tokens, 150);
});

test('OpenAI extracts usage from Responses API format', () => {
    const provider = new OpenAIProvider();
    const usage = provider.extractUsage({
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
    });
    
    assertEqual(usage.prompt_tokens, 100);
    assertEqual(usage.completion_tokens, 50);
    assertEqual(usage.total_tokens, 150);
});

test('OpenAI parses streaming chunks', () => {
    const provider = new OpenAIProvider();
    const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" World"}}]}\n\n';
    
    const parsed = provider.parseStreamChunk(chunk);
    assertEqual(parsed.content, 'Hello World');
    assertEqual(parsed.done, false);
});

test('OpenAI detects [DONE] in stream', () => {
    const provider = new OpenAIProvider();
    const chunk = 'data: [DONE]\n\n';
    
    const parsed = provider.parseStreamChunk(chunk);
    assertEqual(parsed.done, true);
});

// ============ Ollama Provider Tests ============

console.log(`\n${c.cyan}Ollama Provider${c.reset}\n`);

test('Ollama uses HTTP module', () => {
    const provider = new OllamaProvider();
    const httpModule = provider.getHttpModule();
    assertEqual(httpModule, require('http'));
});

test('Ollama uses correct default host and port', () => {
    const provider = new OllamaProvider();
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'localhost');
    assertEqual(target.port, 11434);
    assertEqual(target.protocol, 'http');
});

test('Ollama does not require authorization header', () => {
    const provider = new OllamaProvider();
    const headers = provider.transformRequestHeaders({}, {});
    
    assertEqual(headers['Content-Type'], 'application/json');
    assert(!headers['Authorization'], 'Should not have Authorization');
});

// ============ Anthropic Provider Tests ============

console.log(`\n${c.cyan}Anthropic Provider${c.reset}\n`);

test('Anthropic maps /v1/chat/completions to /v1/messages', () => {
    const provider = new AnthropicProvider();
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.path, '/v1/messages');
    assertEqual(target.hostname, 'api.anthropic.com');
});

test('Anthropic transforms headers with x-api-key', () => {
    const provider = new AnthropicProvider();
    const headers = provider.transformRequestHeaders(
        { authorization: 'Bearer sk-ant-test123' },
        {}
    );
    
    assertEqual(headers['x-api-key'], 'sk-ant-test123');
    assertEqual(headers['anthropic-version'], '2023-06-01');
    assertEqual(headers['Content-Type'], 'application/json');
    assert(!headers['Authorization'], 'Should not have Authorization');
});

test('Anthropic accepts x-api-key header directly', () => {
    const provider = new AnthropicProvider();
    const headers = provider.transformRequestHeaders(
        { 'x-api-key': 'direct-key' },
        {}
    );
    
    assertEqual(headers['x-api-key'], 'direct-key');
});

test('Anthropic transforms request body - extracts system message', () => {
    const provider = new AnthropicProvider();
    const body = {
        model: 'claude-3-haiku',
        messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' }
        ]
    };
    
    const transformed = provider.transformRequestBody(body, {});
    
    assertEqual(transformed.system, 'You are helpful');
    assertEqual(transformed.messages.length, 1);
    assertEqual(transformed.messages[0].role, 'user');
    assertEqual(transformed.messages[0].content, 'Hello');
    assertEqual(transformed.max_tokens, 4096);
});

test('Anthropic preserves max_tokens if provided', () => {
    const provider = new AnthropicProvider();
    const body = {
        model: 'claude-3-haiku',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }]
    };
    
    const transformed = provider.transformRequestBody(body, {});
    assertEqual(transformed.max_tokens, 1000);
});

test('Anthropic transforms stop to stop_sequences', () => {
    const provider = new AnthropicProvider();
    const body = {
        model: 'claude-3-haiku',
        messages: [{ role: 'user', content: 'Hello' }],
        stop: 'END'
    };
    
    const transformed = provider.transformRequestBody(body, {});
    assertDeepEqual(transformed.stop_sequences, ['END']);
});

test('Anthropic normalizes response to OpenAI format', () => {
    const provider = new AnthropicProvider();
    const anthropicResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-haiku',
        content: [{ type: 'text', text: 'Hello there!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
    };
    
    const normalized = provider.normalizeResponse(anthropicResponse, { body: {} });
    
    assertEqual(normalized.model, 'claude-3-haiku');
    assertEqual(normalized.data.choices[0].message.content, 'Hello there!');
    assertEqual(normalized.data.choices[0].finish_reason, 'stop');
    assertEqual(normalized.usage.prompt_tokens, 10);
    assertEqual(normalized.usage.completion_tokens, 5);
    assertEqual(normalized.usage.total_tokens, 15);
});

test('Anthropic parses streaming chunks', () => {
    const provider = new AnthropicProvider();
    const chunk = `event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}

`;
    
    const parsed = provider.parseStreamChunk(chunk);
    assertEqual(parsed.content, 'Hello World');
});

test('Anthropic detects message_stop event', () => {
    const provider = new AnthropicProvider();
    const chunk = `event: message_stop
data: {"type":"message_stop"}

`;
    
    const parsed = provider.parseStreamChunk(chunk);
    assertEqual(parsed.done, true);
});

// ============ Gemini Provider Tests ============

console.log(`\n${c.cyan}Gemini Provider${c.reset}\n`);

test('Gemini resolves for /gemini/* paths', () => {
    const { provider, cleanPath } = registry.resolve({ path: '/gemini/v1/chat/completions', headers: {} });
    assertEqual(provider.name, 'gemini');
    assertEqual(cleanPath, '/v1/chat/completions');
});

test('Gemini getTarget builds correct endpoint with model', () => {
    const provider = new GeminiProvider();
    const target = provider.getTarget({ 
        path: '/v1/chat/completions',
        body: { model: 'gemini-2.0-flash' },
        headers: { authorization: 'Bearer test-key' }
    });
    
    assertEqual(target.hostname, 'generativelanguage.googleapis.com');
    assert(target.path.includes('/v1beta/models/gemini-2.0-flash:generateContent'), 'Path should include model');
    assert(target.path.includes('key=test-key'), 'Path should include API key');
});

test('Gemini uses streamGenerateContent for streaming requests', () => {
    const provider = new GeminiProvider();
    const target = provider.getTarget({ 
        path: '/v1/chat/completions',
        body: { model: 'gemini-2.0-flash', stream: true },
        headers: { authorization: 'Bearer test-key' }
    });
    
    assert(target.path.includes(':streamGenerateContent'), 'Should use streaming endpoint');
});

test('Gemini transforms OpenAI messages to contents format', () => {
    const provider = new GeminiProvider();
    const body = {
        model: 'gemini-2.0-flash',
        messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' }
        ],
        max_tokens: 1000,
        temperature: 0.7
    };
    
    const transformed = provider.transformRequestBody(body, {});
    
    // System message should be in systemInstruction
    assertEqual(transformed.systemInstruction.parts[0].text, 'You are helpful');
    
    // Other messages should be in contents
    assertEqual(transformed.contents.length, 3);
    assertEqual(transformed.contents[0].role, 'user');
    assertEqual(transformed.contents[0].parts[0].text, 'Hello');
    assertEqual(transformed.contents[1].role, 'model');  // assistant -> model
    assertEqual(transformed.contents[2].role, 'user');
    
    // Generation config
    assertEqual(transformed.generationConfig.maxOutputTokens, 1000);
    assertEqual(transformed.generationConfig.temperature, 0.7);
});

test('Gemini passes through native format', () => {
    const provider = new GeminiProvider();
    const body = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
    };
    
    const transformed = provider.transformRequestBody(body, {});
    assertDeepEqual(transformed, body);
});

test('Gemini normalizes response to OpenAI format', () => {
    const provider = new GeminiProvider();
    const geminiResponse = {
        candidates: [{
            content: {
                parts: [{ text: 'Hello there!' }],
                role: 'model'
            },
            finishReason: 'STOP'
        }],
        usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15
        }
    };
    
    const normalized = provider.normalizeResponse(geminiResponse, { body: { model: 'gemini-2.0-flash' } });
    
    assertEqual(normalized.model, 'gemini-2.0-flash');
    assertEqual(normalized.data.choices[0].message.content, 'Hello there!');
    assertEqual(normalized.data.choices[0].finish_reason, 'stop');
    assertEqual(normalized.usage.prompt_tokens, 10);
    assertEqual(normalized.usage.completion_tokens, 5);
    assertEqual(normalized.usage.total_tokens, 15);
});

test('Gemini extracts usage from usageMetadata', () => {
    const provider = new GeminiProvider();
    const usage = provider.extractUsage({
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
    });
    
    assertEqual(usage.prompt_tokens, 100);
    assertEqual(usage.completion_tokens, 50);
    assertEqual(usage.total_tokens, 150);
});

test('Gemini extracts API key from Authorization header', () => {
    const provider = new GeminiProvider();
    const key = provider.extractApiKey({ authorization: 'Bearer my-api-key' });
    assertEqual(key, 'my-api-key');
});

test('Gemini extracts API key from x-goog-api-key header', () => {
    const provider = new GeminiProvider();
    const key = provider.extractApiKey({ 'x-goog-api-key': 'direct-key' });
    assertEqual(key, 'direct-key');
});

// ============ Cohere Provider Tests ============

console.log(`\n${c.cyan}Cohere Provider${c.reset}\n`);

test('Cohere resolves for /cohere/* paths', () => {
    const { provider, cleanPath } = registry.resolve({ path: '/cohere/v1/chat/completions', headers: {} });
    assertEqual(provider.name, 'cohere');
    assertEqual(cleanPath, '/v1/chat/completions');
});

test('Cohere maps /v1/chat/completions to /v2/chat', () => {
    const provider = new CohereProvider();
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'api.cohere.com');
    assertEqual(target.path, '/v2/chat');
});

test('Cohere transforms stop to stop_sequences', () => {
    const provider = new CohereProvider();
    const body = {
        model: 'command',
        messages: [{ role: 'user', content: 'Hello' }],
        stop: 'END',
        top_p: 0.9
    };
    
    const transformed = provider.transformRequestBody(body, {});
    assertDeepEqual(transformed.stop_sequences, ['END']);
    assertEqual(transformed.p, 0.9);  // top_p -> p
});

test('Cohere normalizes response with nested content array', () => {
    const provider = new CohereProvider();
    const cohereResponse = {
        id: 'resp-123',
        finish_reason: 'COMPLETE',
        message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello there!' }]
        },
        usage: {
            tokens: { input_tokens: 10, output_tokens: 5 },
            billed_units: { input_tokens: 10, output_tokens: 5 }
        }
    };
    
    const normalized = provider.normalizeResponse(cohereResponse, { body: { model: 'command' } });
    
    assertEqual(normalized.data.choices[0].message.content, 'Hello there!');
    assertEqual(normalized.data.choices[0].finish_reason, 'stop');
    assertEqual(normalized.usage.prompt_tokens, 10);
    assertEqual(normalized.usage.completion_tokens, 5);
});

test('Cohere parses streaming content-delta events', () => {
    const provider = new CohereProvider();
    const chunk = `data: {"type":"content-delta","index":0,"delta":{"message":{"content":[{"type":"text","text":"Hello"}]}}}

data: {"type":"content-delta","index":0,"delta":{"message":{"content":[{"type":"text","text":" World"}]}}}

`;
    
    const parsed = provider.parseStreamChunk(chunk);
    assertEqual(parsed.content, 'Hello World');
});

test('Cohere detects message-end event with usage', () => {
    const provider = new CohereProvider();
    const chunk = `data: {"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"tokens":{"input_tokens":10,"output_tokens":5}}}}

`;
    
    const parsed = provider.parseStreamChunk(chunk);
    assertEqual(parsed.done, true);
    assertEqual(parsed.usage.prompt_tokens, 10);
    assertEqual(parsed.usage.completion_tokens, 5);
});

// ============ Azure OpenAI Provider Tests ============

console.log(`\n${c.cyan}Azure OpenAI Provider${c.reset}\n`);

test('Azure resolves for /azure/* paths', () => {
    const { provider, cleanPath } = registry.resolve({ path: '/azure/v1/chat/completions', headers: {} });
    assertEqual(provider.name, 'azure');
    assertEqual(cleanPath, '/v1/chat/completions');
});

test('Azure builds correct endpoint with deployment name', () => {
    const provider = new AzureOpenAIProvider({ resource: 'my-resource' });
    const target = provider.getTarget({ 
        path: '/v1/chat/completions',
        body: { model: 'gpt-4' },
        headers: {}
    });
    
    assertEqual(target.hostname, 'my-resource.openai.azure.com');
    assert(target.path.includes('/openai/deployments/gpt-4/chat/completions'), 'Path should include deployment');
    assert(target.path.includes('api-version='), 'Path should include api-version');
});

test('Azure converts model with dots to deployment name', () => {
    const provider = new AzureOpenAIProvider({ resource: 'test' });
    const deployment = provider.getDeploymentName('gpt-3.5-turbo');
    assertEqual(deployment, 'gpt-35-turbo');
});

test('Azure transforms Authorization Bearer to api-key header', () => {
    const provider = new AzureOpenAIProvider();
    const headers = provider.transformRequestHeaders(
        { authorization: 'Bearer my-azure-key' },
        {}
    );
    
    assertEqual(headers['api-key'], 'my-azure-key');
    assert(!headers['Authorization'], 'Should not have Authorization');
});

test('Azure uses api-key header directly if provided', () => {
    const provider = new AzureOpenAIProvider();
    const headers = provider.transformRequestHeaders(
        { 'api-key': 'direct-key' },
        {}
    );
    
    assertEqual(headers['api-key'], 'direct-key');
});

test('Azure allows resource override via header', () => {
    const provider = new AzureOpenAIProvider({ resource: 'default-resource' });
    const resource = provider.getResourceName({ 'x-azure-resource': 'custom-resource' });
    assertEqual(resource, 'custom-resource');
});

// ============ OpenAI-Compatible Provider Tests ============

console.log(`\n${c.cyan}OpenAI-Compatible Providers${c.reset}\n`);

test('Groq provider uses correct hostname', () => {
    const { provider } = registry.resolve({ path: '/groq/v1/chat/completions', headers: {} });
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'api.groq.com');
    assertEqual(target.path, '/openai/v1/chat/completions');
});

test('Mistral provider uses correct hostname', () => {
    const { provider } = registry.resolve({ path: '/mistral/v1/chat/completions', headers: {} });
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'api.mistral.ai');
    assertEqual(target.path, '/v1/chat/completions');
});

test('Together provider uses correct hostname', () => {
    const { provider } = registry.resolve({ path: '/together/v1/chat/completions', headers: {} });
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'api.together.xyz');
});

test('OpenRouter provider uses correct hostname and base path', () => {
    const { provider } = registry.resolve({ path: '/openrouter/v1/chat/completions', headers: {} });
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'openrouter.ai');
    assertEqual(target.path, '/api/v1/chat/completions');
});

test('Perplexity provider has no v1 prefix', () => {
    const { provider } = registry.resolve({ path: '/perplexity/v1/chat/completions', headers: {} });
    const target = provider.getTarget({ path: '/v1/chat/completions' });
    
    assertEqual(target.hostname, 'api.perplexity.ai');
    assertEqual(target.path, '/v1/chat/completions');
});

// ============ Streaming Detection ============

console.log(`\n${c.cyan}Streaming Detection${c.reset}\n`);

test('detects streaming request from body.stream=true', () => {
    const provider = new OpenAIProvider();
    assert(provider.isStreamingRequest({ body: { stream: true } }), 'Should detect stream:true');
    assert(!provider.isStreamingRequest({ body: { stream: false } }), 'Should not detect stream:false');
    assert(!provider.isStreamingRequest({ body: {} }), 'Should not detect missing stream');
});

// ============ Summary ============

console.log(`\n${'─'.repeat(40)}`);
console.log(`${c.green}Passed: ${passed}${c.reset}`);
if (failed > 0) {
    console.log(`${c.red}Failed: ${failed}${c.reset}`);
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
