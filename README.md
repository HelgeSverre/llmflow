# LLMFlow

**Trace every LLM call. See the full picture.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/Storage-SQLite-003B57.svg)](https://sqlite.org)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-OTLP-purple.svg)](https://opentelemetry.io)

LLMFlow is a **local-first observability tool** for LLM applications. Trace your agents, chains, and LLM calls with hierarchical spans—like OpenTelemetry, but purpose-built for AI.

**No cloud. No subscriptions. Just run it.**

---

## Quick Start

```bash
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow
npm install && npm start
```

- **Dashboard:** [localhost:3000](http://localhost:3000)
- **Proxy:** [localhost:8080](http://localhost:8080)

---

## Features

| Feature | Description |
|---------|-------------|
| 🌲 **Hierarchical Spans** | Trace agents, chains, tools, retrievals, and LLM calls |
| 🔍 **Span Tree View** | Visualize the full execution flow of your AI pipelines |
| 🔌 **Zero-code Proxy** | Just change your OpenAI base URL |
| 📡 **OTLP Support** | Works with OpenTelemetry & OpenLLMetry |
| 💰 **Cost Tracking** | Real-time pricing for 2000+ models |
| 🔎 **Search & Filter** | Find spans by type, model, status, or content |
| 💾 **SQLite Storage** | Persistent, queryable, no database setup |

---

## Integration Methods

### 1. Proxy (Zero Code)

Point your OpenAI SDK at the proxy. All calls are automatically traced.

```python
# Python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8080/v1")
```

```javascript
// JavaScript
const client = new OpenAI({ baseURL: 'http://localhost:8080/v1' });
```

```php
// PHP
$client = OpenAI::factory()->withBaseUri('http://localhost:8080/v1')->make();
```

### 2. JavaScript SDK

Create custom spans for complex workflows.

**Installation:**

```bash
# Install from GitHub (recommended)
npm install github:HelgeSverre/llmflow#main --prefix sdk

# Or link locally during development
cd sdk && npm link && cd .. && npm link llmflow-sdk
```

**Usage:**

```javascript
import { trace, span, currentTraceHeaders } from 'llmflow-sdk';

await trace('rag-pipeline', async () => {
    const docs = await span('retrieval', 'vector-search', async () => {
        return await vectorDB.search(query);
    });
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: query }]
    }, { headers: currentTraceHeaders() });
    
    return response.choices[0].message.content;
});
```

**Auto-wrap OpenAI client:**

```javascript
import { wrapOpenAI } from 'llmflow-sdk';
import OpenAI from 'openai';

const client = wrapOpenAI(new OpenAI());
// All chat.completions.create calls now include trace headers automatically
```

### 3. OpenTelemetry / OpenLLMetry

Export traces from existing OTEL instrumentation:

```javascript
// JavaScript - Configure OTLP exporter
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

new OTLPTraceExporter({
    url: 'http://localhost:3000/v1/traces'
});
```

```python
# Python - Configure OTLP exporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

OTLPSpanExporter(endpoint="http://localhost:3000/v1/traces")
```

---

## Framework Integration

### LangChain

```javascript
// JavaScript - LangChain with OpenLLMetry
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { LangChainInstrumentation } from '@traceloop/instrumentation-langchain';

const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: 'http://localhost:3000/v1/traces' }),
    instrumentations: [new LangChainInstrumentation()]
});
sdk.start();
```

```python
# Python - LangChain with OpenLLMetry
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.langchain import LangchainInstrumentor

# After configuring OTLP exporter to LLMFlow
LangchainInstrumentor().instrument()
```

### LlamaIndex

```python
# Python - LlamaIndex with OpenLLMetry
from opentelemetry.instrumentation.llamaindex import LlamaIndexInstrumentor

LlamaIndexInstrumentor().instrument()
```

### CrewAI

```python
# Python - CrewAI with OpenLLMetry
from opentelemetry.instrumentation.crewai import CrewAIInstrumentor

CrewAIInstrumentor().instrument()
```

### Anthropic Claude

```javascript
// JavaScript
import { AnthropicInstrumentation } from '@traceloop/instrumentation-anthropic';

const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: 'http://localhost:3000/v1/traces' }),
    instrumentations: [new AnthropicInstrumentation()]
});
```

```python
# Python
from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor

AnthropicInstrumentor().instrument()
```

### Vercel AI SDK

```javascript
// JavaScript - Vercel AI SDK with built-in telemetry
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: 'http://localhost:3000/v1/traces' })
});
sdk.start();

// Enable telemetry on each call
const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: 'Hello, world!',
    experimental_telemetry: { isEnabled: true }
});
```

### Cohere

```python
from opentelemetry.instrumentation.cohere import CohereInstrumentor

CohereInstrumentor().instrument()
```

### Vector Databases

LLMFlow automatically detects and categorizes vector DB operations:

```python
# Pinecone
from opentelemetry.instrumentation.pinecone import PineconeInstrumentor
PineconeInstrumentor().instrument()

# Chroma
from opentelemetry.instrumentation.chromadb import ChromaInstrumentor
ChromaInstrumentor().instrument()

# Weaviate
from opentelemetry.instrumentation.weaviate import WeaviateInstrumentor
WeaviateInstrumentor().instrument()
```

---

## Supported OTEL Attributes

LLMFlow automatically extracts these OpenTelemetry semantic conventions:

| Attribute | Description |
|-----------|-------------|
| `gen_ai.system` | Provider (openai, anthropic, cohere) |
| `gen_ai.request.model` | Model name |
| `gen_ai.usage.prompt_tokens` | Input token count |
| `gen_ai.usage.completion_tokens` | Output token count |
| `gen_ai.prompt` | Input messages |
| `gen_ai.completion` | Output content |
| `traceloop.span.kind` | Span type (workflow, agent, tool) |
| `db.system` | Vector DB (pinecone, chroma, weaviate) |

---

## Span Types

| Type | Description | Use Case |
|------|-------------|----------|
| `trace` | Root span | Workflow entry point |
| `llm` | LLM API call | Chat completions, embeddings |
| `agent` | Agent execution | ReAct loops, tool-using agents |
| `chain` | Chain step | LangChain chains, pipelines |
| `tool` | Tool call | Function calls, API calls |
| `retrieval` | Vector search | RAG retrieval, document lookup |
| `embedding` | Embedding generation | Text to vector |

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/traces` | OTLP/HTTP trace ingestion |
| `POST /api/spans` | SDK span ingestion |
| `GET /api/traces` | List traces with filters |
| `GET /api/traces/:id` | Get trace details |
| `GET /api/traces/:id/tree` | Get span tree |
| `GET /api/stats` | Aggregate statistics |
| `GET /api/health` | Health check |

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `q` | Full-text search |
| `model` | Filter by model |
| `status` | `success` or `error` |
| `date_from` | Start timestamp (ms) |
| `date_to` | End timestamp (ms) |
| `limit` | Results per page |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | `8080` | OpenAI proxy port |
| `DASHBOARD_PORT` | `3000` | Dashboard & OTLP port |
| `DATA_DIR` | `~/.llmflow` | Data directory |
| `MAX_TRACES` | `10000` | Max traces to retain |
| `VERBOSE` | `0` | Enable verbose logging |

---

## Examples

See the [examples/](examples/) folder for complete integration examples:

| Example | Framework | Description |
|---------|-----------|-------------|
| [langchain](examples/langchain) | LangChain.js | OpenLLMetry auto-instrumentation |
| [vercel-ai-sdk](examples/vercel-ai-sdk) | Vercel AI SDK | Built-in telemetry |
| [voltagent](examples/voltagent) | VoltAgent | Agent framework tracing |

---

## Demo & Testing

```bash
# Generate sample traces
npm run demo

# Run all tests
npm test

# Run OTLP tests only
npm run test:otlp
```

---

## Docker

```bash
# Run with Docker Compose
docker-compose up

# Run tests in Docker
make docker-test
```

---

## Architecture

```
Your App
    │
    ├── SDK ──────────────────┐
    │   trace(), span()       │
    │                         ▼
    ├── OTLP Exporter ──► Dashboard (:3000) ──► SQLite
    │                         │
    └── OpenAI SDK ──────► Proxy (:8080) ────► OpenAI API
```

---

## Roadmap

- [x] Hierarchical span tracing
- [x] Span tree visualization
- [x] JavaScript SDK
- [x] SQLite storage
- [x] Dynamic pricing (2000+ models)
- [x] Streaming support
- [x] Search & filtering
- [x] OTLP/HTTP support
- [ ] Real-time WebSocket updates
- [ ] Multi-provider proxy (Anthropic, Ollama)
- [ ] Dark mode
- [ ] Trace export (JSON, OTLP)

---

## License

MIT © [Helge Sverre](https://github.com/HelgeSverre)
