# LLMFlow SDK

Minimal tracing SDK for LLM applications. Create hierarchical spans to trace your AI pipelines.

## Installation

The SDK is included in the LLMFlow repository. Copy `sdk/index.js` to your project or reference it directly:

```javascript
const { trace, span, currentTraceHeaders, wrapOpenAI } = require('./sdk');
```

## Quick Start

```javascript
const { trace, span, currentTraceHeaders } = require('./sdk');
const OpenAI = require('openai');

// Use the LLMFlow proxy for automatic LLM call tracing
const openai = new OpenAI({ baseURL: 'http://localhost:8080/v1' });

await trace('my-workflow', async () => {
    // Custom span for retrieval
    const docs = await span('retrieval', 'search_docs', async () => {
        return await vectorDB.search('query');
    });
    
    // LLM call - automatically traced via proxy
    // currentTraceHeaders() links it to the parent span
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello!' }]
    }, {
        headers: currentTraceHeaders()
    });
    
    return response.choices[0].message.content;
});
```

## API Reference

### `trace(name, fn, opts?)`

Start a root trace. All spans created inside `fn` are children of this trace.

```javascript
await trace('answer-question', async () => {
    // Your workflow here
});

// With options
await trace('answer-question', async () => {
    // ...
}, {
    input: { question: 'What is X?' },
    tags: ['production'],
    serviceName: 'my-app'
});
```

### `span(type, name, fn)` or `span(opts, fn)`

Create a span within the current trace context.

**Shorthand:**
```javascript
await span('retrieval', 'vector_search', async () => {
    return await db.search(query);
});

await span('tool', 'send_email', async () => {
    return await sendEmail(to, subject, body);
});
```

**Full options:**
```javascript
await span({
    type: 'retrieval',
    name: 'search_documents',
    input: { query: 'search term', top_k: 5 },
    attributes: { database: 'pinecone', index: 'main' },
    tags: ['vector-search'],
    serviceName: 'retrieval-service'
}, async () => {
    const results = await pinecone.query(query);
    return results; // Captured as span output
});
```

### `currentTraceHeaders()`

Get headers to attach to LLM API calls for trace propagation.

```javascript
const headers = currentTraceHeaders();
// Returns: { 'x-trace-id': '...', 'x-parent-id': '...' }

// Use with OpenAI
const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...]
}, {
    headers: currentTraceHeaders()
});
```

### `wrapOpenAI(client)`

Wrap an OpenAI client to automatically inject trace headers into all requests.

```javascript
const OpenAI = require('openai');
const { wrapOpenAI } = require('./sdk');

const openai = wrapOpenAI(new OpenAI({
    baseURL: 'http://localhost:8080/v1'
}));

// Headers are automatically injected
await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }]
});
```

### `getCurrentSpan()`

Get the current span context (useful for advanced use cases).

```javascript
const ctx = getCurrentSpan();
if (ctx) {
    console.log('Current trace:', ctx.traceId);
    console.log('Current span:', ctx.spanId);
    console.log('Parent span:', ctx.parentId);
}
```

### `generateId()`

Generate a UUID for custom span IDs.

```javascript
const id = generateId();
// Returns: '550e8400-e29b-41d4-a716-446655440000'
```

## Span Types

Use these standard types for consistent visualization:

| Type | Use Case |
|------|----------|
| `trace` | Root span (auto-set by `trace()`) |
| `llm` | LLM API calls |
| `agent` | Agent execution loops |
| `chain` | Chain/pipeline steps |
| `tool` | Tool/function calls |
| `retrieval` | Vector search, document lookup |
| `embedding` | Embedding generation |
| `custom` | Anything else |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLMFLOW_URL` | `http://localhost:3000` | LLMFlow dashboard URL |
| `LLMFLOW_DEBUG` | (unset) | Enable debug logging |

## Examples

### RAG Pipeline

```javascript
await trace('rag-query', async () => {
    // 1. Embed the query
    const embedding = await span('embedding', 'embed_query', async () => {
        return await embedder.embed(query);
    });
    
    // 2. Search vector DB
    const docs = await span('retrieval', 'vector_search', async () => {
        return await vectorDB.search(embedding, { topK: 5 });
    });
    
    // 3. Generate answer
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: `Context:\n${docs.join('\n')}` },
            { role: 'user', content: query }
        ]
    }, { headers: currentTraceHeaders() });
    
    return response.choices[0].message.content;
});
```

### Agent with Tools

```javascript
await trace('agent-task', async () => {
    let done = false;
    let iteration = 0;
    
    while (!done && iteration < 10) {
        iteration++;
        
        const response = await span('agent', `step-${iteration}`, async () => {
            return await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: conversationHistory,
                tools: toolDefinitions
            }, { headers: currentTraceHeaders() });
        });
        
        const message = response.choices[0].message;
        
        if (message.tool_calls) {
            for (const call of message.tool_calls) {
                const result = await span('tool', call.function.name, async () => {
                    return await executeTool(call.function.name, call.function.arguments);
                });
                conversationHistory.push({ role: 'tool', content: result, tool_call_id: call.id });
            }
        } else {
            done = true;
        }
    }
});
```

### Parallel Operations

```javascript
await trace('parallel-search', async () => {
    // Spans can be created in parallel
    const [webResults, dbResults, cacheResults] = await Promise.all([
        span('retrieval', 'web_search', () => searchWeb(query)),
        span('retrieval', 'db_search', () => searchDatabase(query)),
        span('retrieval', 'cache_lookup', () => checkCache(query))
    ]);
    
    return { webResults, dbResults, cacheResults };
});
```

## How It Works

The SDK uses Node.js `AsyncLocalStorage` to propagate trace context through async operations. When you call `trace()` or `span()`, the SDK:

1. Creates a new span ID and associates it with the current trace
2. Runs your function within an async context that holds the span info
3. On completion/error, sends the span data to LLMFlow via `POST /api/spans`
4. Returns the result of your function

LLM calls made through the proxy with `x-trace-id` and `x-parent-id` headers are automatically linked to the span tree.

## TypeScript

TypeScript definitions are included in `sdk/index.d.ts`:

```typescript
import { trace, span, SpanOptions, SpanContext } from './sdk';

const opts: SpanOptions = {
    type: 'retrieval',
    name: 'search',
    input: { query: 'test' }
};

await span(opts, async () => {
    // ...
});
```

## License

MIT
