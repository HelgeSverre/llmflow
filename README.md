# LLMFlow

**See what your LLM calls cost. One command. No signup.**

LLMFlow is a local observability tool for LLM applications. Point your SDK at it, see your costs, tokens, and latency in real-time.

```bash
npx llmflow
```

Dashboard: [localhost:3000](http://localhost:3000) · Proxy: [localhost:8080](http://localhost:8080)

---

## Quick Start

### 1. Start LLMFlow

```bash
# Option A: npx (recommended)
npx llmflow

# Option B: Clone and run
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow && npm install && npm start

# Option C: Docker
docker run -p 3000:3000 -p 8080:8080 helgesverre/llmflow
```

### 2. Point Your SDK

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

### 3. View Dashboard

Open [localhost:3000](http://localhost:3000) to see your traces, costs, and token usage.

---

## Who Is This For?

- **Solo developers** building with OpenAI, Anthropic, etc.
- **Hobbyists** who want to see what their AI projects cost
- **Anyone** who doesn't want to pay for or set up a SaaS observability tool

---

## Features

| Feature | Description |
|---------|-------------|
| **Cost Tracking** | Real-time pricing for 2000+ models |
| **Request Logging** | See every request/response with latency |
| **Multi-Provider** | OpenAI, Anthropic, Gemini, Ollama, Groq, Mistral, and more |
| **OpenTelemetry** | Accept traces from LangChain, LlamaIndex, etc. |
| **Zero Config** | Just run it, point your SDK, done |
| **Local Storage** | SQLite database, no external services |

---

## Supported Providers

Use path prefixes or the `X-LLMFlow-Provider` header:

| Provider | URL |
|----------|-----|
| OpenAI | `http://localhost:8080/v1` (default) |
| Anthropic | `http://localhost:8080/anthropic/v1` |
| Gemini | `http://localhost:8080/gemini/v1` |
| Ollama | `http://localhost:8080/ollama/v1` |
| Groq | `http://localhost:8080/groq/v1` |
| Mistral | `http://localhost:8080/mistral/v1` |
| Azure OpenAI | `http://localhost:8080/azure/v1` |
| Cohere | `http://localhost:8080/cohere/v1` |
| Together | `http://localhost:8080/together/v1` |
| OpenRouter | `http://localhost:8080/openrouter/v1` |
| Perplexity | `http://localhost:8080/perplexity/v1` |

---

## OpenTelemetry Support

If you're using LangChain, LlamaIndex, or other instrumented frameworks:

```python
# Python - point OTLP exporter to LLMFlow
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(endpoint="http://localhost:3000/v1/traces")
```

```javascript
// JavaScript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

new OTLPTraceExporter({ url: 'http://localhost:3000/v1/traces' });
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | `8080` | Proxy port |
| `DASHBOARD_PORT` | `3000` | Dashboard port |
| `DATA_DIR` | `~/.llmflow` | Data directory |
| `MAX_TRACES` | `10000` | Max traces to retain |
| `VERBOSE` | `0` | Enable verbose logging |

Set provider API keys as environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) if you want the proxy to forward requests.

---

## Advanced Features

For advanced usage, see the [docs/](docs/) folder:

- [AI CLI Tools](docs/guides/ai-cli-tools.md) - Claude Code, Codex CLI, Gemini CLI
- [Observability Backends](docs/guides/observability-backends.md) - Export to Jaeger, Langfuse, Phoenix
- [Passthrough Mode](docs/guides/ai-cli-tools.md#passthrough-mode) - Forward native API formats

---

## License

MIT © [Helge Sverre](https://github.com/HelgeSverre)
