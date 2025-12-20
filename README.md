# LLMFlow

**Trace every LLM call. See the full picture.**

LLMFlow is a local-first observability tool for LLM applications. Trace your agents, chains, and LLM calls with hierarchical spans—like OpenTelemetry, but built for AI.

![Dashboard](https://img.shields.io/badge/dashboard-localhost:3000-blue) ![Proxy](https://img.shields.io/badge/proxy-localhost:8080-green) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Quick Start

```bash
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow
npm install && npm start
```

Dashboard at [localhost:3000](http://localhost:3000), proxy at `localhost:8080`.

## Features

- **Hierarchical Spans** — Trace agents, chains, tools, retrievals, and LLM calls
- **Span Tree View** — See the full execution flow of your AI pipelines  
- **Zero-code Proxy** — Just change your OpenAI base URL
- **SDK for Custom Spans** — Instrument any code with `span()` and `trace()`
- **Token & Cost Tracking** — Real-time pricing from 2000+ models
- **Search & Filter** — Find spans by type, model, status, or content
- **SQLite Storage** — Persistent, no database setup

---

## Usage

### Option 1: Proxy (Zero Code)

Point your OpenAI SDK at the proxy—all calls are automatically traced.

**Python:**
```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8080/v1")

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**JavaScript:**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({ baseURL: 'http://localhost:8080/v1' });

const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }]
});
```

**PHP:**
```php
$client = OpenAI::factory()
    ->withBaseUri('http://localhost:8080/v1')
    ->withApiKey($_ENV['OPENAI_API_KEY'])
    ->make();

$response = $client->chat()->create([
    'model' => 'gpt-4o-mini',
    'messages' => [['role' => 'user', 'content' => 'Hello!']]
]);
```

### Option 2: SDK (Full Control)

Use the SDK to create custom spans and trace complex workflows:

```javascript
const { trace, span, currentTraceHeaders } = require('./sdk');
const OpenAI = require('openai');

const openai = new OpenAI({ baseURL: 'http://localhost:8080/v1' });

await trace('answer-question', async () => {
    // Retrieval span
    const docs = await span('retrieval', 'search_docs', async () => {
        return await vectorDB.search('How do I configure SSL?');
    });
    
    // LLM call (automatically traced via proxy)
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: `Context: ${docs}` },
            { role: 'user', content: 'How do I configure SSL?' }
        ]
    }, {
        headers: currentTraceHeaders() // Links to parent span
    });
    
    return response.choices[0].message.content;
});
```

---

## Integrations

### LangChain.js

Wrap your LangChain chains with LLMFlow spans:

```javascript
const { trace, span, wrapOpenAI } = require('./sdk');
const { ChatOpenAI } = require('@langchain/openai');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { ChatPromptTemplate } = require('@langchain/core/prompts');

const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    configuration: { baseURL: 'http://localhost:8080/v1' }
});

const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant.'],
    ['human', '{input}']
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

// Trace the entire chain
await trace('langchain-qa', async () => {
    const result = await chain.invoke({ input: 'What is LangChain?' });
    return result;
});
```

### Vercel AI SDK

Use with the Vercel AI SDK for streaming:

```javascript
const { trace, span, currentTraceHeaders } = require('./sdk');
const { openai } = require('@ai-sdk/openai');
const { streamText } = require('ai');

const customOpenAI = openai.chat('gpt-4o-mini', {
    baseURL: 'http://localhost:8080/v1'
});

await trace('ai-chat', async () => {
    const result = await streamText({
        model: customOpenAI,
        messages: [{ role: 'user', content: 'Write a haiku about coding' }],
        headers: currentTraceHeaders()
    });
    
    for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
    }
});
```

### Express Middleware

Add automatic tracing to your Express routes:

```javascript
const express = require('express');
const { trace, currentTraceHeaders } = require('./sdk');
const OpenAI = require('openai');

const app = express();
const openai = new OpenAI({ baseURL: 'http://localhost:8080/v1' });

// Middleware to wrap each request in a trace
app.use((req, res, next) => {
    trace(`${req.method} ${req.path}`, async () => {
        return new Promise((resolve) => {
            res.on('finish', resolve);
            next();
        });
    });
});

app.post('/api/chat', async (req, res) => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: req.body.messages
    }, {
        headers: currentTraceHeaders()
    });
    
    res.json(response);
});
```

### Python (Manual Span Injection)

For Python, inject trace headers manually:

```python
import requests
import uuid
from openai import OpenAI

LLMFLOW_URL = "http://localhost:3000"

def create_span(trace_id, parent_id, span_type, name, input_data=None, output_data=None, duration_ms=0):
    """Send a span to LLMFlow."""
    requests.post(f"{LLMFLOW_URL}/api/spans", json={
        "id": str(uuid.uuid4()),
        "trace_id": trace_id,
        "parent_id": parent_id,
        "span_type": span_type,
        "span_name": name,
        "duration_ms": duration_ms,
        "input": input_data,
        "output": output_data,
        "status": 200
    })

# Example: RAG workflow with spans
trace_id = str(uuid.uuid4())
root_span_id = str(uuid.uuid4())

# Create root trace span
create_span(trace_id, None, "trace", "rag-query", {"query": "What is Python?"})

# Retrieval step
retrieval_span_id = str(uuid.uuid4())
docs = search_vector_db("What is Python?")  # Your retrieval logic
create_span(trace_id, root_span_id, "retrieval", "vector_search", 
            {"query": "What is Python?"}, {"docs": docs}, 150)

# LLM call via proxy (auto-traced, linked to parent)
client = OpenAI(base_url="http://localhost:8080/v1")
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is Python?"}],
    extra_headers={
        "x-trace-id": trace_id,
        "x-parent-id": root_span_id
    }
)
```

### Agent Loops

Trace iterative agent workflows:

```javascript
const { trace, span, currentTraceHeaders } = require('./sdk');
const OpenAI = require('openai');

const openai = new OpenAI({ baseURL: 'http://localhost:8080/v1' });

await trace('agent-task', async () => {
    let iteration = 0;
    let done = false;
    
    while (!done && iteration < 5) {
        iteration++;
        
        // Agent thinking step
        const response = await span('agent', `iteration-${iteration}`, async () => {
            return await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are an agent. Use tools when needed.' },
                    { role: 'user', content: 'Find the weather in Tokyo' }
                ],
                tools: [{ type: 'function', function: { name: 'get_weather', parameters: {} }}]
            }, { headers: currentTraceHeaders() });
        });
        
        // Tool execution
        if (response.choices[0].message.tool_calls) {
            await span('tool', 'get_weather', async () => {
                return { temperature: 22, condition: 'sunny' };
            });
        } else {
            done = true;
        }
    }
});
```

---

## Span Types

| Type | Description | Color |
|------|-------------|-------|
| `trace` | Root span for a workflow | Blue |
| `llm` | LLM API call | Green |
| `agent` | Agent execution | Orange |
| `chain` | Chain/pipeline step | Purple |
| `tool` | Tool/function call | Pink |
| `retrieval` | Vector search / document lookup | Cyan |
| `embedding` | Embedding generation | Indigo |
| `custom` | User-defined span | Gray |

---

## SDK API Reference

```javascript
const { trace, span, currentTraceHeaders, wrapOpenAI, getCurrentSpan } = require('./sdk');

// Start a root trace
await trace('workflow-name', async () => { ... });

// Create a span within current trace
await span('type', 'name', async () => { ... });

// Full span options
await span({
    type: 'retrieval',
    name: 'search_documents',
    input: { query: 'search term' },
    attributes: { db: 'pinecone' },
    tags: ['production']
}, async () => { ... });

// Get headers for LLM calls (trace propagation)
const headers = currentTraceHeaders();
// Returns: { 'x-trace-id': '...', 'x-parent-id': '...' }

// Wrap OpenAI client for automatic header injection
const client = wrapOpenAI(new OpenAI({ baseURL: 'http://localhost:8080/v1' }));
// All chat.completions.create() calls auto-inject trace headers

// Get current span context
const ctx = getCurrentSpan();
// Returns: { spanId, traceId, parentId } or null
```

---

## Demo

Generate sample traces without an API key:

```bash
npm run demo           # 5 traces with spans
npm run demo:many      # 20 traces
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/spans` | Ingest spans from SDK |
| `GET /api/traces` | List spans with filters |
| `GET /api/traces/:id` | Get single span details |
| `GET /api/traces/:id/tree` | Get span tree for a trace |
| `GET /api/stats` | Aggregate statistics |
| `GET /api/models` | List distinct models |
| `GET /api/health` | Health check |

### Query Parameters for `/api/traces`

| Parameter | Description |
|-----------|-------------|
| `q` | Full-text search in request/response/input/output |
| `model` | Filter by model name |
| `status` | `success` or `error` |
| `date_from` | Unix timestamp (ms) |
| `date_to` | Unix timestamp (ms) |
| `limit` | Number of results (default: 50) |
| `offset` | Pagination offset |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | `8080` | Proxy server port |
| `DASHBOARD_PORT` | `3000` | Dashboard port |
| `DATA_DIR` | `~/.llmflow` | Data directory |
| `MAX_TRACES` | `10000` | Max spans to keep |
| `VERBOSE` | `0` | Enable verbose logging |

---

## Architecture

```
Your App
    │
    ├── SDK ──────────────────┐
    │   (custom spans)        │
    │                         ▼
    └── OpenAI SDK ──► Proxy (:8080) ──► OpenAI API
                          │
                          ▼
                      SQLite DB
                          │
                          ▼
                    Dashboard (:3000)
```

---

## Docker

```bash
docker-compose up
```

Or build and run manually:

```bash
docker build -t llmflow .
docker run -p 3000:3000 -p 8080:8080 -v llmflow-data:/root/.llmflow llmflow
```

---

## Roadmap

- [x] Hierarchical span tracing
- [x] Span tree visualization  
- [x] SDK for custom instrumentation
- [x] SQLite storage
- [x] Dynamic pricing (2000+ models)
- [x] Streaming support
- [x] Search & filtering
- [ ] Python SDK
- [ ] Real-time WebSocket updates
- [ ] Multi-provider support (Anthropic, Ollama)
- [ ] Dark mode
- [ ] Export traces (JSON, OTLP)

---

## License

MIT
