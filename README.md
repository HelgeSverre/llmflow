# LLMFlow

**See what your LLM calls cost. One command. No signup.**

LLMFlow is a local observability tool for LLM applications. Point your SDK at it, see your costs, tokens, and latency in real-time.

```bash
npx llmflow
```

Dashboard: [localhost:1337](http://localhost:1337) · Proxy: [localhost:8080](http://localhost:8080)

![LLMFlow Dashboard](art/screenshot-dark.png)

---

## Quick Start

### 1. Start LLMFlow

```bash
# Option A: npx (recommended)
npx llmflow

# Option B: Clone and run (requires Bun)
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow && bun install && bun run dev

# Option C: Docker
docker run -p 1337:1337 -p 8080:8080 helgesverre/llmflow
```

### 2. Point Your SDK

```python
# Python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8080/v1")
```

```javascript
// JavaScript
const client = new OpenAI({ baseURL: 'http://localhost:8080/v1' })
```

```php
// PHP
$client = OpenAI::factory()->withBaseUri('http://localhost:8080/v1')->make();
```

### 3. View Dashboard

Open [localhost:1337](http://localhost:1337) to see your traces, costs, and token usage.

---

## Who Is This For?

- **Solo developers** building with OpenAI, Anthropic, etc.
- **Hobbyists** who want to see what their AI projects cost
- **Anyone** who doesn't want to pay for or set up a SaaS observability tool

---

## Features

| Feature                 | Description                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| **Cost Tracking**       | Real-time pricing for 2000+ models                                                    |
| **Request Logging**     | See every request/response with latency                                               |
| **Multi-Provider**      | OpenAI, Anthropic, Gemini, Ollama, Groq, Mistral, and more                            |
| **OpenTelemetry**       | Accept OTLP/HTTP traces from LangChain, LlamaIndex, Traceloop, Vercel AI SDK, etc.    |
| **Session correlation** | Group multi-turn agent runs under one session via `session.id` (OpenInference / OTel) |
| **Span timeline**       | Virtualized waterfall view; ~5k spans per trace stays smooth                          |
| **Zero Config**         | Just run it, point your SDK, done                                                     |
| **Local Storage**       | SQLite database, no external services                                                 |

---

## Supported Providers

Use path prefixes or the `X-LLMFlow-Provider` header:

| Provider     | URL                                   |
| ------------ | ------------------------------------- |
| OpenAI       | `http://localhost:8080/v1` (default)  |
| Anthropic    | `http://localhost:8080/anthropic/v1`  |
| Gemini       | `http://localhost:8080/gemini/v1`     |
| Ollama       | `http://localhost:8080/ollama/v1`     |
| Groq         | `http://localhost:8080/groq/v1`       |
| Mistral      | `http://localhost:8080/mistral/v1`    |
| Azure OpenAI | `http://localhost:8080/azure/v1`      |
| Cohere       | `http://localhost:8080/cohere/v1`     |
| Together     | `http://localhost:8080/together/v1`   |
| OpenRouter   | `http://localhost:8080/openrouter/v1` |
| Perplexity   | `http://localhost:8080/perplexity/v1` |

---

## OpenTelemetry Support

If you're using LangChain, LlamaIndex, or other instrumented frameworks:

```python
# Python - point OTLP exporter to LLMFlow
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(endpoint="http://localhost:1337/v1/traces")
```

```javascript
// JavaScript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

new OTLPTraceExporter({ url: 'http://localhost:1337/v1/traces' })
```

### Session correlation

If your spans carry one of these attributes, LLMFlow groups multiple traces into
a single session and exposes them in the **Sessions** tab:

| Convention                      | Attribute                                     |
| ------------------------------- | --------------------------------------------- |
| OpenInference / Phoenix / Arize | `session.id` _(recommended)_                  |
| LangSmith                       | `langsmith.trace.session_id`                  |
| Traceloop / OpenLLMetry         | `traceloop.association.properties.session_id` |
| Vercel AI SDK                   | `ai.telemetry.metadata.sessionId`             |
| OTel resource fallback          | `service.instance.id` resource attribute      |

For chat-thread correlation, set `gen_ai.conversation.id` (OTel) or
`traceloop.association.properties.thread_id`.

---

## Configuration

| Variable         | Default      | Description                                             |
| ---------------- | ------------ | ------------------------------------------------------- |
| `PROXY_PORT`     | `8080`       | Proxy port                                              |
| `DASHBOARD_PORT` | `1337`       | Dashboard + OTLP receiver port                          |
| `DATA_DIR`       | `~/.llmflow` | Data directory                                          |
| `MAX_TRACES`     | `10000`      | Max traces to retain                                    |
| `VERBOSE`        | `0`          | Enable verbose logging                                  |

Set provider API keys as environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) if you want the proxy to forward requests.

---

## Pricing data

The "what your LLM calls cost" number comes from a live model price table — there's no hand-maintained cost lookup in this repo. Two things matter for trust in that number:

**Source.** `@llmflow/pricing` pulls [BerriAI/litellm's `model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) over HTTPS on boot and again every 24 hours. That's the canonical community-maintained table for ~2000 models across OpenAI, Anthropic, Google, Azure, Cohere, Mistral, Together, OpenRouter, Perplexity, Groq, and Ollama. Override the URL with `PRICING_URL` if you mirror it internally.

**Fallback.** If the boot-time fetch fails (offline laptop, blocked egress, LiteLLM is down), LLMFlow falls back to the bundled snapshot at `packages/pricing/pricing.fallback.json`. Costs keep being calculated, but rates are frozen to whatever was current when that file was last regenerated.

**How to tell which one you're on.** Hit `GET /api/health`:

```json
{
  "status": "ok",
  "timestamp": 1716800000000,
  "pricing": {
    "source": "litellm",                    // or "fallback" / "unknown"
    "last_updated": 1716799000000,          // ms since epoch
    "model_count": 2143,
    "upstream_url": "https://raw.githubusercontent.com/BerriAI/litellm/..."
  }
}
```

The dashboard shows a warning banner when `source: "fallback"` and the data is more than 7 days old.

**Refreshing manually.** A restart re-fetches. If you can't restart, the background refresh runs every 24 hours. To regenerate the bundled fallback file (for offline installs), curl the upstream JSON into `packages/pricing/pricing.fallback.json` and commit it.

**When pricing is unknown.** For models that don't appear in the table, LLMFlow falls back to a generic placeholder rate (`$0.001 / 1k prompt tokens`, `$0.002 / 1k completion tokens`). Cost numbers for those models are indicative only — check `/api/health` and the Models tab to see which models are unmatched.

---

## Security

LLMFlow is designed to run on `localhost`. It has no built-in authentication today, so anything that can reach the ports can read your traces and send requests to your provider keys.

**Default binding.** When you run `npx llmflow`, the server binds to all interfaces. On a single-user laptop behind a firewall that's fine. On a shared network, a cloud VM, or a coffee-shop Wi-Fi, it isn't. There are two safe patterns:

```bash
# Bind to loopback only (safest for local dev)
HOST=127.0.0.1 npx llmflow
```

```bash
# Docker: publish the ports on loopback rather than 0.0.0.0
docker run -p 127.0.0.1:1337:1337 -p 127.0.0.1:8080:8080 helgesverre/llmflow
```

> **Heads up.** The default `docker-compose.yml` in this repo publishes ports on `0.0.0.0` for convenience. If your host has a public IP — or you're on a network with other users — change the `ports:` entries to the `127.0.0.1:HOST:CONTAINER` form above before running it.

**Provider keys.** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. live in the environment of the LLMFlow process. Anyone who can hit `/v1/*` can spend against them — treat the listening surface accordingly.

**OTLP receiver.** The OTLP endpoints (`POST /v1/traces`, `/v1/logs`, `/v1/metrics`) sit on the dashboard port and accept any well-formed payload. If you open `:1337` to the network, expect arbitrary spans to land in your local SQLite.

Bearer-token auth (`LLMFLOW_TOKEN`) and a 127.0.0.1 default bind are tracked work; until they land, the patterns above are the supported way to harden a deployment.

---

## Development

LLMFlow is a Bun workspaces monorepo (`apps/server`, `apps/dashboard`, plus
six packages under `packages/`). Bun is required.

```bash
# Clone and install (one workspace install at root covers every package)
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow && bun install

# Server (dashboard on :1337, proxy on :8080)
bun run dev

# Dashboard dev server with HMR (separate terminal, proxies /api + /ws)
bun run dev:dashboard

# Build dashboard for production (outputs to /public/)
bun run build

# Tests
bun run test                # server unit/integration
bun run --filter @llmflow/dashboard test    # viewport vitest suite
bun run test:e2e            # Playwright
```

The dashboard is Svelte 5 + Vite 8 and builds to `/public/` at the repo root.
The bin entry `bin/llmflow.js` (used by `npx llmflow`) spawns
`apps/server/src/server.ts` directly.

---

## Advanced Features

For advanced usage, see the [docs/](docs/) folder:

- [AI CLI Tools](docs/guides/ai-cli-tools.md) - Claude Code, Codex CLI, Gemini CLI
- [Observability Backends](docs/guides/observability-backends.md) - Export to Jaeger, Langfuse, Phoenix
- [Passthrough Mode](docs/guides/ai-cli-tools.md#passthrough-mode) - Forward native API formats

---

## License

MIT © [Helge Sverre](https://github.com/HelgeSverre)
