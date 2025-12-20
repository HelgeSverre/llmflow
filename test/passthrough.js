#!/usr/bin/env node

/**
 * Passthrough Handler Unit Tests
 * 
 * Tests passthrough handler logic without making real API calls.
 */

const { 
    PassthroughHandler, 
    AnthropicPassthrough, 
    GeminiPassthrough, 
    OpenAIPassthrough 
} = require('../providers/passthrough');

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

// ============ Base PassthroughHandler Tests ============

console.log(`\n${c.cyan}Base PassthroughHandler${c.reset}\n`);

test('creates handler with default options', () => {
    const handler = new PassthroughHandler({
        name: 'test',
        targetHost: 'api.example.com'
    });
    
    assertEqual(handler.name, 'test');
    assertEqual(handler.targetHost, 'api.example.com');
    assertEqual(handler.targetPort, 443);
    assertEqual(handler.protocol, 'https');
});

test('getTarget preserves original path', () => {
    const handler = new PassthroughHandler({
        targetHost: 'api.example.com'
    });
    
    const target = handler.getTarget({ path: '/v1/messages' });
    
    assertEqual(target.hostname, 'api.example.com');
    assertEqual(target.port, 443);
    assertEqual(target.path, '/v1/messages');
});

test('isStreamingRequest detects stream=true', () => {
    const handler = new PassthroughHandler({ targetHost: 'api.example.com' });
    
    assert(handler.isStreamingRequest({ body: { stream: true } }), 'Should detect stream:true');
    assert(!handler.isStreamingRequest({ body: { stream: false } }), 'Should not detect stream:false');
    assert(!handler.isStreamingRequest({ body: {} }), 'Should not detect missing stream');
});

test('sanitizeHeaders removes sensitive headers', () => {
    const handler = new PassthroughHandler({ targetHost: 'api.example.com' });
    
    const sanitized = handler.sanitizeHeaders({
        'content-type': 'application/json',
        'x-api-key': 'secret-key',
        'authorization': 'Bearer secret',
        'x-goog-api-key': 'google-key',
        'api-key': 'azure-key',
        'x-custom-header': 'safe'
    });
    
    assertEqual(sanitized['content-type'], 'application/json');
    assertEqual(sanitized['x-custom-header'], 'safe');
    assert(!sanitized['x-api-key'], 'Should remove x-api-key');
    assert(!sanitized['authorization'], 'Should remove authorization');
    assert(!sanitized['x-goog-api-key'], 'Should remove x-goog-api-key');
    assert(!sanitized['api-key'], 'Should remove api-key');
});

// ============ AnthropicPassthrough Tests ============

console.log(`\n${c.cyan}AnthropicPassthrough${c.reset}\n`);

test('AnthropicPassthrough has correct target host', () => {
    const handler = new AnthropicPassthrough();
    
    assertEqual(handler.name, 'anthropic-passthrough');
    assertEqual(handler.targetHost, 'api.anthropic.com');
});

test('AnthropicPassthrough getTarget preserves path', () => {
    const handler = new AnthropicPassthrough();
    const target = handler.getTarget({ path: '/v1/messages' });
    
    assertEqual(target.hostname, 'api.anthropic.com');
    assertEqual(target.path, '/v1/messages');
});

test('AnthropicPassthrough transforms headers with x-api-key', () => {
    const handler = new AnthropicPassthrough();
    
    const headers = handler.defaultHeaderTransform({
        'x-api-key': 'my-api-key',
        'anthropic-version': '2024-01-01'
    });
    
    assertEqual(headers['x-api-key'], 'my-api-key');
    assertEqual(headers['anthropic-version'], '2024-01-01');
    assertEqual(headers['Content-Type'], 'application/json');
});

test('AnthropicPassthrough transforms headers with Authorization Bearer', () => {
    const handler = new AnthropicPassthrough();
    
    const headers = handler.defaultHeaderTransform({
        'authorization': 'Bearer my-bearer-key'
    });
    
    assertEqual(headers['x-api-key'], 'my-bearer-key');
    assertEqual(headers['anthropic-version'], '2023-06-01'); // default
});

test('AnthropicPassthrough passes through anthropic-beta header', () => {
    const handler = new AnthropicPassthrough();
    
    const headers = handler.defaultHeaderTransform({
        'x-api-key': 'key',
        'anthropic-beta': 'prompt-caching-2024-07-31'
    });
    
    assertEqual(headers['anthropic-beta'], 'prompt-caching-2024-07-31');
});

test('AnthropicPassthrough extracts usage from native response', () => {
    const handler = new AnthropicPassthrough();
    
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
            cache_read_input_tokens: 10
        }
    };
    
    const usage = handler.defaultExtractUsage(response);
    
    assertEqual(usage.prompt_tokens, 15);
    assertEqual(usage.completion_tokens, 8);
    assertEqual(usage.total_tokens, 23);
    assertEqual(usage.cache_creation_input_tokens, 0);
    assertEqual(usage.cache_read_input_tokens, 10);
});

test('AnthropicPassthrough identifies model from response', () => {
    const handler = new AnthropicPassthrough();
    
    const model = handler.defaultIdentifyModel(
        { model: 'claude-3-haiku-20240307' },
        { model: 'claude-3-5-haiku-20241022' }
    );
    
    assertEqual(model, 'claude-3-5-haiku-20241022'); // prefers response model
});

test('AnthropicPassthrough parses streaming content_block_delta', () => {
    const handler = new AnthropicPassthrough();
    
    const chunk = `event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}

`;
    
    const parsed = handler.defaultParseStreamChunk(chunk);
    
    assertEqual(parsed.content, 'Hello World');
    assertEqual(parsed.done, false);
});

test('AnthropicPassthrough parses streaming message_stop', () => {
    const handler = new AnthropicPassthrough();
    
    const chunk = `event: message_stop
data: {"type":"message_stop"}

`;
    
    const parsed = handler.defaultParseStreamChunk(chunk);
    
    assertEqual(parsed.done, true);
});

test('AnthropicPassthrough parses streaming usage from message_delta', () => {
    const handler = new AnthropicPassthrough();
    
    const chunk = `event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}

`;
    
    const parsed = handler.defaultParseStreamChunk(chunk);
    
    assertEqual(parsed.usage.completion_tokens, 42);
});

test('AnthropicPassthrough parses streaming usage from message_start', () => {
    const handler = new AnthropicPassthrough();
    
    const chunk = `event: message_start
data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude-3-haiku-20240307","content":[],"usage":{"input_tokens":25}}}

`;
    
    const parsed = handler.defaultParseStreamChunk(chunk);
    
    assertEqual(parsed.usage.prompt_tokens, 25);
});

// ============ GeminiPassthrough Tests ============

console.log(`\n${c.cyan}GeminiPassthrough${c.reset}\n`);

test('GeminiPassthrough has correct target host', () => {
    const handler = new GeminiPassthrough();
    
    assertEqual(handler.name, 'gemini-passthrough');
    assertEqual(handler.targetHost, 'generativelanguage.googleapis.com');
});

test('GeminiPassthrough adds API key to query string', () => {
    const handler = new GeminiPassthrough();
    
    const target = handler.getTarget({
        path: '/v1beta/models/gemini-pro:generateContent',
        headers: { 'x-goog-api-key': 'my-api-key' }
    });
    
    assertEqual(target.hostname, 'generativelanguage.googleapis.com');
    assert(target.path.includes('key=my-api-key'), 'Should add API key to query');
});

test('GeminiPassthrough extracts API key from Authorization header', () => {
    const handler = new GeminiPassthrough();
    
    const key = handler.extractApiKey({ authorization: 'Bearer gemini-key' });
    assertEqual(key, 'gemini-key');
});

test('GeminiPassthrough extracts API key from x-goog-api-key header', () => {
    const handler = new GeminiPassthrough();
    
    const key = handler.extractApiKey({ 'x-goog-api-key': 'direct-key' });
    assertEqual(key, 'direct-key');
});

test('GeminiPassthrough extracts usage from native response', () => {
    const handler = new GeminiPassthrough();
    
    const response = {
        candidates: [{
            content: { parts: [{ text: 'Hello!' }], role: 'model' },
            finishReason: 'STOP'
        }],
        usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15
        }
    };
    
    const usage = handler.defaultExtractUsage(response);
    
    assertEqual(usage.prompt_tokens, 10);
    assertEqual(usage.completion_tokens, 5);
    assertEqual(usage.total_tokens, 15);
});

test('GeminiPassthrough parses JSON streaming response', () => {
    const handler = new GeminiPassthrough();
    
    const chunk = JSON.stringify({
        candidates: [{
            content: { parts: [{ text: 'Hello World' }], role: 'model' },
            finishReason: 'STOP'
        }],
        usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15
        }
    });
    
    const parsed = handler.defaultParseStreamChunk(chunk);
    
    assertEqual(parsed.content, 'Hello World');
    assertEqual(parsed.done, true);
    assertEqual(parsed.usage.prompt_tokens, 10);
});

// ============ OpenAIPassthrough Tests ============

console.log(`\n${c.cyan}OpenAIPassthrough${c.reset}\n`);

test('OpenAIPassthrough has correct target host', () => {
    const handler = new OpenAIPassthrough();
    
    assertEqual(handler.name, 'openai-passthrough');
    assertEqual(handler.targetHost, 'api.openai.com');
});

test('OpenAIPassthrough transforms headers correctly', () => {
    const handler = new OpenAIPassthrough();
    
    const headers = handler.defaultHeaderTransform({
        'authorization': 'Bearer sk-test123'
    });
    
    assertEqual(headers['Authorization'], 'Bearer sk-test123');
    assertEqual(headers['Content-Type'], 'application/json');
});

test('OpenAIPassthrough extracts usage from response', () => {
    const handler = new OpenAIPassthrough();
    
    const response = {
        id: 'chatcmpl-123',
        model: 'gpt-4o-mini',
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
        }
    };
    
    const usage = handler.defaultExtractUsage(response);
    
    assertEqual(usage.prompt_tokens, 10);
    assertEqual(usage.completion_tokens, 5);
    assertEqual(usage.total_tokens, 15);
});

test('OpenAIPassthrough extracts usage from Responses API format', () => {
    const handler = new OpenAIPassthrough();
    
    const response = {
        id: 'resp-123',
        model: 'gpt-4.1',
        usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150
        }
    };
    
    const usage = handler.defaultExtractUsage(response);
    
    assertEqual(usage.prompt_tokens, 100);
    assertEqual(usage.completion_tokens, 50);
    assertEqual(usage.total_tokens, 150);
});

test('OpenAIPassthrough parses streaming chunks', () => {
    const handler = new OpenAIPassthrough();
    
    const chunk = `data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"chatcmpl-123","choices":[{"delta":{"content":" World"}}]}

`;
    
    const parsed = handler.defaultParseStreamChunk(chunk);
    
    assertEqual(parsed.content, 'Hello World');
    assertEqual(parsed.done, false);
});

test('OpenAIPassthrough detects [DONE] in stream', () => {
    const handler = new OpenAIPassthrough();
    
    const chunk = `data: [DONE]

`;
    
    const parsed = handler.defaultParseStreamChunk(chunk);
    
    assertEqual(parsed.done, true);
});

// ============ Summary ============

console.log(`\n${'─'.repeat(40)}`);
console.log(`${c.green}Passed: ${passed}${c.reset}`);
if (failed > 0) {
    console.log(`${c.red}Failed: ${failed}${c.reset}`);
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
