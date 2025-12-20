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
| 🔌 **Multi-Provider Proxy** | OpenAI, Anthropic, Ollama, Groq, Mistral & more |
| 🤖 **AI CLI Tools Support** | Claude Code, Codex CLI, Gemini CLI, Aider |
| 📡 **OTLP Support** | Traces, logs, and metrics from OpenTelemetry |
| 💰 **Cost Tracking** | Real-time pricing for 1000+ models |
| 🔎 **Unified Timeline** | See all activity from all tools in one view |
| 💾 **SQLite Storage** | Persistent, queryable, no database setup |
| 📊 **Analytics Dashboard** | Token trends, cost by tool/model charts |

---

## Integration Methods

### 1. Proxy (Zero Code)

Point your LLM SDK at the proxy. All calls are automatically traced.

#### OpenAI (Default)

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

#### Multi-Provider Support

The proxy supports multiple providers via path prefixes:

| Provider | Path Prefix | Example |
|----------|-------------|---------|
| OpenAI | `/v1/*` (default) | `http://localhost:8080/v1/chat/completions` |
| Anthropic | `/anthropic/*` | `http://localhost:8080/anthropic/v1/messages` |
| Google Gemini | `/gemini/*` | `http://localhost:8080/gemini/v1/chat/completions` |
| Cohere | `/cohere/*` | `http://localhost:8080/cohere/v1/chat/completions` |
| Azure OpenAI | `/azure/*` | `http://localhost:8080/azure/v1/chat/completions` |
| Ollama | `/ollama/*` | `http://localhost:8080/ollama/v1/chat/completions` |
| Groq | `/groq/*` | `http://localhost:8080/groq/v1/chat/completions` |
| Mistral | `/mistral/*` | `http://localhost:8080/mistral/v1/chat/completions` |
| Together | `/together/*` | `http://localhost:8080/together/v1/chat/completions` |
| Perplexity | `/perplexity/*` | `http://localhost:8080/perplexity/chat/completions` |
| OpenRouter | `/openrouter/*` | `http://localhost:8080/openrouter/v1/chat/completions` |

Or use the `X-LLMFlow-Provider` header to override:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "X-LLMFlow-Provider: groq" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Hi"}]}'
```

#### Custom Tags

Add custom tags to traces using the `X-LLMFlow-Tag` header for better filtering:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "X-LLMFlow-Tag: user:alice, env:prod, feature:chat" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hi"}]}'
```

Tags appear in the dashboard and can be used for filtering and analytics.

#### Provider Examples

```python
# Anthropic via proxy
import anthropic
client = anthropic.Anthropic(
    base_url="http://localhost:8080/anthropic"
)

# Ollama via proxy (no API key needed)
from openai import OpenAI
client = OpenAI(
    base_url="http://localhost:8080/ollama/v1",
    api_key="not-needed"
)

# Groq via proxy
from openai import OpenAI
client = OpenAI(
    base_url="http://localhost:8080/groq/v1",
    api_key=os.getenv("GROQ_API_KEY")
)

# Cohere via proxy
import cohere
client = cohere.ClientV2(
    base_url="http://localhost:8080/cohere",
    api_key=os.getenv("COHERE_API_KEY")
)

# Azure OpenAI via proxy
from openai import AzureOpenAI
client = AzureOpenAI(
    base_url="http://localhost:8080/azure/v1",
    api_key=os.getenv("AZURE_OPENAI_API_KEY")
)
# Note: Set x-azure-resource header for resource name
```

```javascript
// Anthropic via proxy
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({
    baseURL: 'http://localhost:8080/anthropic'
});

// Ollama via proxy
const client = new OpenAI({
    baseURL: 'http://localhost:8080/ollama/v1',
    apiKey: 'not-needed'
});

// Gemini via proxy (using OpenAI-compatible format)
const client = new OpenAI({
    baseURL: 'http://localhost:8080/gemini/v1',
    apiKey: process.env.GOOGLE_API_KEY
});

// Azure OpenAI via proxy
const client = new OpenAI({
    baseURL: 'http://localhost:8080/azure/v1',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    defaultHeaders: { 'x-azure-resource': 'your-resource-name' }
});
```

### 2. Passthrough Mode (AI CLI Tools)

For AI CLI tools that use native API formats (Claude Code, Gemini CLI), use passthrough mode to proxy requests without transformation while still getting full observability.

#### Claude Code

```bash
# Set Claude Code to use LLMFlow passthrough
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic

# Run Claude Code - all requests are logged with full observability
claude
```

#### Gemini CLI

```bash
# Configure Gemini CLI
# In .gemini/settings.json or via environment
export GEMINI_API_BASE=http://localhost:8080/passthrough/gemini
```

#### Passthrough Routes

| Provider | Passthrough Path | Native API |
|----------|------------------|------------|
| Anthropic | `/passthrough/anthropic/*` | api.anthropic.com |
| Gemini | `/passthrough/gemini/*` | generativelanguage.googleapis.com |
| OpenAI | `/passthrough/openai/*` | api.openai.com |

**Key difference from regular proxy:**
- Regular proxy (`/anthropic/*`) transforms OpenAI format ↔ native format
- Passthrough (`/passthrough/anthropic/*`) forwards native format as-is

Both modes provide full observability: request/response logging, token counting, cost tracking.

### 3. JavaScript SDK

Create custom spans for complex workflows.

**Installation:**

```bash
# Install from GitHub
npm install github:HelgeSverre/llmflow-sdk

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

### 4. OpenTelemetry / OpenLLMetry

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

### OTLP Ingestion

| Endpoint | Description |
|----------|-------------|
| `POST /v1/traces` | OTLP/HTTP trace ingestion |
| `POST /v1/logs` | OTLP/HTTP log ingestion |
| `POST /v1/metrics` | OTLP/HTTP metrics ingestion |

### Dashboard API

| Endpoint | Description |
|----------|-------------|
| `GET /api/traces` | List traces with filters |
| `GET /api/traces/:id` | Get trace details |
| `GET /api/traces/:id/tree` | Get span tree |
| `GET /api/traces/export` | Export traces as JSON/JSONL |
| `GET /api/logs` | List logs with filters |
| `GET /api/logs/:id` | Get log details |
| `GET /api/metrics` | List metrics with filters |
| `GET /api/stats` | Aggregate statistics |
| `GET /api/analytics/token-trends` | Token usage over time |
| `GET /api/analytics/cost-by-tool` | Cost breakdown by tool |
| `GET /api/analytics/cost-by-model` | Cost breakdown by model |
| `GET /api/analytics/daily` | Daily summary stats |
| `GET /api/health` | Health check |
| `GET /api/health/providers` | Check provider API key validity |

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

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | `8080` | Proxy port |
| `DASHBOARD_PORT` | `3000` | Dashboard & OTLP port |
| `DATA_DIR` | `~/.llmflow` | Data directory |
| `MAX_TRACES` | `10000` | Max traces to retain |
| `VERBOSE` | `0` | Enable verbose logging |

### Provider API Keys

| Variable | Provider | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | OpenAI | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic | Anthropic Claude API key |
| `GOOGLE_API_KEY` | Gemini | Google AI API key (or `GEMINI_API_KEY`) |
| `COHERE_API_KEY` | Cohere | Cohere API key |
| `GROQ_API_KEY` | Groq | Groq API key |
| `MISTRAL_API_KEY` | Mistral | Mistral AI API key |
| `TOGETHER_API_KEY` | Together | Together AI API key |
| `PERPLEXITY_API_KEY` | Perplexity | Perplexity API key |
| `OPENROUTER_API_KEY` | OpenRouter | OpenRouter API key |

### Provider-Specific Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `localhost` | Ollama server hostname |
| `OLLAMA_PORT` | `11434` | Ollama server port |
| `AZURE_OPENAI_RESOURCE` | - | Azure OpenAI resource name |
| `AZURE_OPENAI_API_KEY` | - | Azure OpenAI API key |
| `AZURE_OPENAI_API_VERSION` | `2024-02-01` | Azure OpenAI API version |

### OTLP Export Settings

Export traces to external observability backends like Jaeger, Phoenix, Langfuse, Opik:

| Variable | Description |
|----------|-------------|
| `OTLP_EXPORT_ENDPOINT` | Primary export endpoint |
| `OTLP_EXPORT_TRACES_ENDPOINT` | Traces-specific endpoint |
| `OTLP_EXPORT_LOGS_ENDPOINT` | Logs-specific endpoint |
| `OTLP_EXPORT_METRICS_ENDPOINT` | Metrics-specific endpoint |
| `OTLP_EXPORT_HEADERS` | Auth headers (comma-separated `key=value`) |
| `OTLP_EXPORT_BATCH_SIZE` | Batch size (default: 100) |
| `OTLP_EXPORT_FLUSH_INTERVAL` | Flush interval in ms (default: 5000) |

---

## Observability Backends

LLMFlow can export traces to external observability platforms while keeping a local copy.

### Quick Setup

```bash
# Jaeger (local)
OTLP_EXPORT_ENDPOINT=http://localhost:4318/v1/traces

# Phoenix (Arize)
OTLP_EXPORT_ENDPOINT=http://localhost:6006/v1/traces

# Langfuse (requires auth)
OTLP_EXPORT_ENDPOINT=http://localhost:3001/api/public/otel/v1/traces
OTLP_EXPORT_HEADERS=Authorization=Basic base64(pk:sk)

# Opik (Comet)
OTLP_EXPORT_ENDPOINT=http://localhost:5173/api/v1/private/otel/v1/traces
```

### Helicone Integration

For LLM cost tracking with Helicone, use the passthrough route:

```javascript
const client = new OpenAI({
    baseURL: 'http://localhost:8080/passthrough/helicone/v1',
    defaultHeaders: {
        'Helicone-Auth': 'Bearer sk-helicone-xxx'
    }
});
```

See [docs/guides/observability-backends.md](docs/guides/observability-backends.md) and [examples/observability/](examples/observability/) for detailed setup guides.

---

## Examples

See the [examples/](examples/) folder for complete integration examples:

| Example | Framework | Description |
|---------|-----------|-------------|
| [langchain](examples/langchain) | LangChain.js | OpenLLMetry auto-instrumentation |
| [vercel-ai-sdk](examples/vercel-ai-sdk) | Vercel AI SDK | Built-in telemetry |
| [claude-code](examples/claude-code) | Claude Code | Passthrough mode setup |
| [codex-cli](examples/codex-cli) | Codex CLI | OTLP logs configuration |
| [gemini-cli](examples/gemini-cli) | Gemini CLI | OTLP metrics configuration |
| [aider](examples/aider) | Aider | Proxy mode setup |
| [observability/jaeger](examples/observability/jaeger) | Jaeger | Distributed tracing export |
| [observability/phoenix](examples/observability/phoenix) | Phoenix (Arize) | LLM observability export |
| [observability/langfuse](examples/observability/langfuse) | Langfuse | LLM monitoring export |
| [observability/helicone](examples/observability/helicone) | Helicone | Cost tracking integration |
| [observability/opik](examples/observability/opik) | Opik (Comet) | Experiment tracking export |

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
- [x] OTLP/HTTP traces support
- [x] OTLP/HTTP logs support
- [x] OTLP/HTTP metrics support
- [x] Real-time WebSocket updates
- [x] Dark mode
- [x] Multi-provider proxy (OpenAI, Anthropic, Gemini, Cohere, Azure, Ollama, Groq, Mistral, Together, OpenRouter, Perplexity)
- [x] Passthrough mode for AI CLI tools (Claude Code, Gemini CLI)
- [x] Unified timeline view
- [x] Tool-specific filtering (Claude, Codex, Gemini, Aider)
- [x] Analytics dashboard (token trends, cost by tool/model)
- [x] OTLP export to external backends (Jaeger, Phoenix, Langfuse, Opik)
- [x] Helicone passthrough integration
- [ ] Cost alerts and budgets

---

## License

MIT © [Helge Sverre](https://github.com/HelgeSverre)
