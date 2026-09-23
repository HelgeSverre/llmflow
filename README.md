# LLMFlow

**See what your LLM calls cost. One command. No signup.**

LLMFlow is a local observability tool for LLM applications. Point your SDK at its proxy, or send it
OpenTelemetry data, and see requests, token usage, cost and latency in a dashboard. Everything stays
in a SQLite database on your machine.

```bash
npx llmflow
```

Dashboard: [127.0.0.1:1337](http://127.0.0.1:1337) · Proxy: [127.0.0.1:8080](http://127.0.0.1:8080)

![LLMFlow Dashboard](https://raw.githubusercontent.com/HelgeSverre/llmflow/main/website/screenshot-dark.png)

---

## Quick start

### 1. Start LLMFlow

`npx llmflow` needs [Bun](https://bun.sh/docs/installation) and Node.js: the npm launcher runs on
Node and starts the server with Bun.

```bash
# npm (recommended)
npx llmflow

# From a checkout (requires Bun)
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow && bun install && bun run start

# Docker, published on host loopback only
docker run -p 127.0.0.1:1337:1337 -p 127.0.0.1:8080:8080 helgesverre/llmflow
```

The startup output prints the dashboard and proxy URLs.

### 2. Point your SDK at the proxy

```python
# Python
from openai import OpenAI
client = OpenAI(base_url="http://127.0.0.1:8080/v1")
```

```javascript
// JavaScript
const client = new OpenAI({ baseURL: 'http://127.0.0.1:8080/v1' })
```

```php
// PHP
$client = OpenAI::factory()->withBaseUri('http://127.0.0.1:8080/v1')->make();
```

Your client keeps sending its own API key; LLMFlow forwards it.

### 3. Open the dashboard

Open [127.0.0.1:1337](http://127.0.0.1:1337) to see traces, costs and token usage as requests arrive.

---

## Features

| Feature                 | Description                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Cost tracking**       | Prices from LiteLLM's model table, with a bundled offline fallback                       |
| **Request capture**     | Every request and response with tokens, latency and errors                               |
| **Multi-provider**      | OpenAI, Anthropic, Gemini, Azure OpenAI, Ollama, Groq, Mistral, Cohere and more          |
| **OpenTelemetry**       | OTLP/HTTP traces, logs and metrics from LangChain, LlamaIndex, Vercel AI SDK, CLI agents |
| **Session correlation** | Multi-turn agent runs grouped by `session.id` and related attributes                     |
| **Span waterfall**      | Trace trees with timing, inputs, outputs and tool calls                                  |
| **Replay**              | Re-send a captured request from the dashboard                                            |
| **Forwarding**          | Export what LLMFlow stores to Jaeger, Tempo, Langfuse, Phoenix and other OTLP backends   |
| **Local storage**       | One SQLite file, no external services                                                    |

---

## Supported providers

Send OpenAI-format requests to the proxy. Choose the provider with a path prefix or the
`X-LLMFlow-Provider` header:

| Provider     | Base URL                              |
| ------------ | ------------------------------------- |
| OpenAI       | `http://127.0.0.1:8080/v1` (default)  |
| Anthropic    | `http://127.0.0.1:8080/anthropic/v1`  |
| Gemini       | `http://127.0.0.1:8080/gemini/v1`     |
| Ollama       | `http://127.0.0.1:8080/ollama/v1`     |
| Groq         | `http://127.0.0.1:8080/groq/v1`       |
| Mistral      | `http://127.0.0.1:8080/mistral/v1`    |
| Azure OpenAI | `http://127.0.0.1:8080/azure/v1`      |
| Cohere       | `http://127.0.0.1:8080/cohere/v1`     |
| Together     | `http://127.0.0.1:8080/together/v1`   |
| OpenRouter   | `http://127.0.0.1:8080/openrouter/v1` |
| Perplexity   | `http://127.0.0.1:8080/perplexity/v1` |

These routes translate OpenAI-format requests to each provider's API and back. To send a
provider's own API format unchanged, use a passthrough route: `/passthrough/anthropic/*`,
`/passthrough/gemini/*`, `/passthrough/openai/*` or `/passthrough/helicone/*` (for example
`ANTHROPIC_BASE_URL=http://127.0.0.1:8080/passthrough/anthropic`). Both kinds of route record the
same provider name, so a provider shows up once in Analytics. `GET /providers` on the proxy lists
every route.

Optional request headers:

| Header                       | Effect                                                    |
| ---------------------------- | --------------------------------------------------------- |
| `X-LLMFlow-Service`          | Names the calling application (default `unknown_service`) |
| `X-LLMFlow-Tags`             | Comma-separated tags on the recorded span                 |
| `X-Trace-Id` / `X-Parent-Id` | Attach the call to an existing trace and parent span      |

The [`llmflow-sdk`](packages/sdk/README.md) package creates spans for your own pipeline steps and
sets the trace headers on LLM calls for you.

---

## OpenTelemetry

The dashboard port also receives OTLP/HTTP: `POST /v1/traces`, `/v1/logs` and `/v1/metrics`, as
JSON or protobuf, optionally gzip-compressed.

```python
# Python
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(endpoint="http://127.0.0.1:1337/v1/traces")
```

```javascript
// JavaScript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

new OTLPTraceExporter({ url: 'http://127.0.0.1:1337/v1/traces' })
```

LLMFlow reads the current
[OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai)
(`gen_ai.provider.name`, `gen_ai.usage.input_tokens`, structured `gen_ai.input.messages`, …) and the
deprecated v1.36.0 names (`gen_ai.system`, `gen_ai.usage.prompt_tokens`).

Records whose source names no service (no `service.name` resource attribute, no
`X-LLMFlow-Service` header, no SDK `serviceName`) are stored under `unknown_service`,
OpenTelemetry's default, on every ingest path.

The [examples](examples/README.md) show Claude Code, Codex CLI and Gemini CLI sending telemetry.

### Session correlation

Spans carrying one of these attributes are grouped into one session in the **Sessions** tab:

| Convention                      | Attribute                                     |
| ------------------------------- | --------------------------------------------- |
| OpenInference / Phoenix / Arize | `session.id` _(recommended)_                  |
| LangSmith                       | `langsmith.trace.session_id`                  |
| Traceloop / OpenLLMetry         | `traceloop.association.properties.session_id` |
| Vercel AI SDK                   | `ai.telemetry.metadata.sessionId`             |
| OTel resource fallback          | `service.instance.id` resource attribute      |

For chat-thread correlation, set `gen_ai.conversation.id` (OTel) or
`traceloop.association.properties.thread_id`.

### Forwarding to another backend

LLMFlow can forward what it stores to any OTLP/HTTP backend (Jaeger, Grafana Tempo, Langfuse,
Phoenix, Opik). Set `OTLP_EXPORT_TRACES_ENDPOINT`, and the logs and metrics endpoints if you want
those signals too; the other `OTLP_EXPORT_*` settings are under [Configuration](#configuration).
Records are batched per signal. Set `OTLP_EXPORT_PROTOCOL=http/protobuf` for backends that only
accept protobuf, such as Phoenix.

Forwarded spans are rebuilt from the stored row. They carry the GenAI usage attributes,
`session.id`, `gen_ai.conversation.id`, `gen_ai.agent.name` and the attributes the span arrived
with. Prompt and response bodies that the proxy captured are **not** turned into content
attributes: enable content capture in your instrumentation if the backend should receive it.
Logs and metrics are forwarded with their attributes and resource attributes. Set
`LLMFLOW_OTLP_LEGACY_ATTRS=1` to also export the deprecated GenAI attribute names.

---

## Configuration

Every setting is an environment variable; `.env.example` lists them all with their defaults.

<!-- env:start -->
<!-- Generated from packages/shared/src/config.ts by `bun run env:docs`; edit that list, not this block. -->

**Servers**

| Variable             | Default     | Description                                                             |
| -------------------- | ----------- | ----------------------------------------------------------------------- |
| `PROXY_PORT`         | `8080`      | Proxy port (receives LLM API requests); 0 picks a free port             |
| `DASHBOARD_PORT`     | `1337`      | Dashboard, JSON API and OTLP receiver port; 0 picks a free port         |
| `PROXY_HOST`         | `127.0.0.1` | Interface the proxy binds to (0.0.0.0 accepts remote clients)           |
| `DASHBOARD_HOST`     | `127.0.0.1` | Interface the dashboard binds to (0.0.0.0 accepts remote clients)       |
| `WS_ALLOWED_ORIGINS` |             | Extra origins allowed to open the dashboard WebSocket (comma-separated) |
| `PROXY_TIMEOUT_MS`   | `300000`    | Milliseconds before a proxied upstream request is aborted               |
| `VERBOSE`            | `0`         | Log debug detail (1=on); the --verbose flag does the same               |

**Storage**

| Variable      | Default                                                                                       | Description                                                     |
| ------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `DATA_DIR`    |                                                                                               | Directory for the SQLite database (default: ~/.llmflow)         |
| `DB_PATH`     |                                                                                               | Full path to the SQLite file (default: $DATA_DIR/data.db)       |
| `MAX_SPANS`   | `10000`                                                                                       | Spans to keep; whole traces are pruned oldest first beyond this |
| `MAX_TRACES`  |                                                                                               | Former name of MAX_SPANS, read when MAX_SPANS is unset          |
| `MAX_LOGS`    | `100000`                                                                                      | Log records to keep; the oldest are pruned beyond this          |
| `MAX_METRICS` | `1000000`                                                                                     | Metric points to keep; the oldest are pruned beyond this        |
| `PRICING_URL` | `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json` | Model pricing JSON used for cost estimates                      |

**Provider API keys**

| Variable               | Default | Description                                              |
| ---------------------- | ------- | -------------------------------------------------------- |
| `OPENAI_API_KEY`       |         | OpenAI API key                                           |
| `ANTHROPIC_API_KEY`    |         | Anthropic API key                                        |
| `GEMINI_API_KEY`       |         | Google Gemini API key (wins over GOOGLE_API_KEY)         |
| `GOOGLE_API_KEY`       |         | Google Gemini API key, used when GEMINI_API_KEY is unset |
| `COHERE_API_KEY`       |         | Cohere API key                                           |
| `AZURE_OPENAI_API_KEY` |         | Azure OpenAI API key                                     |
| `GROQ_API_KEY`         |         | Groq API key                                             |
| `MISTRAL_API_KEY`      |         | Mistral AI API key                                       |
| `TOGETHER_API_KEY`     |         | Together AI API key                                      |
| `PERPLEXITY_API_KEY`   |         | Perplexity API key                                       |
| `OPENROUTER_API_KEY`   |         | OpenRouter API key                                       |

**Provider settings**

| Variable                   | Default           | Description                                                                          |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `OLLAMA_HOST`              | `127.0.0.1`       | Ollama host                                                                          |
| `OLLAMA_PORT`              | `11434`           | Ollama port                                                                          |
| `AZURE_OPENAI_RESOURCE`    |                   | Azure OpenAI resource name (an x-azure-resource header wins)                         |
| `AZURE_OPENAI_API_VERSION` | `2024-02-01`      | Azure OpenAI API version                                                             |
| `AZURE_DEPLOYMENT_<MODEL>` |                   | Azure deployment for a model; <MODEL> is the model name uppercased with . and - as _ |
| `HELICONE_HOST`            | `oai.helicone.ai` | Helicone gateway host                                                                |
| `HELICONE_PORT`            | `443`             | Helicone gateway port                                                                |
| `HELICONE_API_KEY`         |                   | Helicone key used when the request has no helicone-auth header                       |

**OTLP export**

| Variable                        | Default     | Description                                                     |
| ------------------------------- | ----------- | --------------------------------------------------------------- |
| `OTLP_EXPORT_ENABLED`           | `false`     | Enable export (true); setting any endpoint enables it too       |
| `OTLP_EXPORT_TRACES_ENDPOINT`   |             | Full traces URL                                                 |
| `OTLP_EXPORT_ENDPOINT`          |             | Alias for the traces URL; it does not enable logs or metrics    |
| `OTLP_EXPORT_LOGS_ENDPOINT`     |             | Full logs URL; logs are exported only when set                  |
| `OTLP_EXPORT_METRICS_ENDPOINT`  |             | Full metrics URL; metrics are exported only when set            |
| `OTLP_EXPORT_PROTOCOL`          | `http/json` | http/json or http/protobuf (Phoenix accepts protobuf only)      |
| `OTLP_EXPORT_HEADERS`           |             | Headers sent with every export (comma-separated key=value)      |
| `OTLP_EXPORT_BATCH_SIZE`        | `100`       | Records per export batch, per signal                            |
| `OTLP_EXPORT_FLUSH_INTERVAL_MS` | `5000`      | Milliseconds between flushes                                    |
| `LLMFLOW_OTLP_LEGACY_ATTRS`     | `0`         | Also export the deprecated v1.36.0 GenAI attribute names (1=on) |

**Development**

| Variable                | Default     | Description                                                                         |
| ----------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `LLMFLOW_URL`           |             | Backend the dashboard dev server and demo target (default: the running dev backend) |
| `LLMFLOW_DEV_STATE_DIR` |             | Where dev servers record their URLs (default: a per-checkout temp directory)        |
| `VITE_PORT`             | `5173`      | Dashboard dev server port                                                           |
| `VITE_HOST`             | `127.0.0.1` | Dashboard dev server bind interface                                                 |
| `LLMFLOW_REUSE_BUILD`   | `0`         | Reuse an existing apps/server/dist instead of rebuilding (1=on; CI)                 |

<!-- env:end -->

The proxy forwards the API key each client sends; the provider keys above are only needed to
replay a captured request from the dashboard.

---

## Pricing data

Costs come from [LiteLLM's model price table](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json),
fetched over HTTPS at startup and every 24 hours. Set `PRICING_URL` to use a mirror.

When the fetch fails (offline, blocked egress), LLMFlow uses a snapshot bundled into the server:
the chat models of the providers LLMFlow proxies, regenerated with `bun run pricing:refresh`. Costs
keep being calculated at the snapshot's rates.

`GET /api/health` reports which table is in use:

```json
{
  "status": "ok",
  "timestamp": 1790190000000,
  "pricing": {
    "source": "litellm",
    "last_updated": 1790189000000,
    "model_count": 4183,
    "upstream_url": "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
  }
}
```

`source` is `litellm`, `fallback` or `unknown`. The dashboard shows a warning banner when the
fallback is in use and was generated more than 7 days ago.

Models missing from the table are costed at a placeholder rate ($0.001 per 1K prompt tokens,
$0.002 per 1K completion tokens), so their cost numbers are indicative only.

---

## Replaying a request

In **Traces**, select a captured request and click **Replay request**. LLMFlow sends it again
through the proxy and opens the new trace; the original capture is unchanged.

Replay works for POST requests captured through the translated proxy routes, including Ollama.
For hosted providers, set the provider's API key (for example `OPENAI_API_KEY`) in the LLMFlow
server environment and restart: stored credentials are redacted and never reused. Telemetry-only
spans, passthrough requests, incomplete bodies and URLs with redacted parameters cannot be replayed.

---

## Security

LLMFlow is built to run on your own machine. It has no authentication: anything that can reach its
ports can read your traces and send requests through the proxy.

- **Binding.** Both listeners bind to `127.0.0.1` by default. Set `DASHBOARD_HOST` and `PROXY_HOST`
  to accept remote clients, and put authenticated access in front.

  ```bash
  DASHBOARD_HOST=0.0.0.0 PROXY_HOST=0.0.0.0 npx llmflow
  ```

- **Docker.** The image listens on all container interfaces; publish the ports on host loopback as
  in the Quick start. The Compose file (`docker compose -f docker/docker-compose.yml up --build`)
  does the same. The image runs as the non-root user `bun` (uid 1000) with its data in
  `/home/bun/.llmflow`; volumes created for `/root/.llmflow` by images up to 0.4.1 need the
  one-time migration in [DOCKER_HUB.md](DOCKER_HUB.md#migrating-from-rootllmflow).
- **Provider keys** in the server environment are used only for replay. The proxy forwards the key
  each client sends.
- **OTLP receiver.** `POST /v1/traces`, `/v1/logs` and `/v1/metrics` accept any well-formed payload.
- **Stored credentials.** Credential headers and credential query parameters are redacted before
  they are stored or broadcast.
- **WebSocket.** Upgrades require a trusted `Origin`: loopback origins at the dashboard port, plus
  any listed in `WS_ALLOWED_ORIGINS` (set it when a reverse proxy serves the dashboard).

---

## Limits and retention

- **Spans.** `MAX_SPANS` bounds stored span rows. Beyond it, whole traces are evicted, oldest
  latest-span first; a single trace larger than the cap is evicted completely. The dashboard marks
  a trace as partial when spans are missing.
- **Logs and metrics.** `MAX_LOGS` and `MAX_METRICS` bound stored rows; the oldest are removed.
- **Proxy.** Idle socket timeouts are off so slow and quiet streams survive; `PROXY_TIMEOUT_MS`
  sets the overall upstream deadline. A client that disconnects cancels the upstream request.
  Capture keeps up to 2 MiB of response text, 2 MiB of tool-call arguments (1 MiB per call),
  4 MiB per streaming event and 16 MiB per non-streaming response.
- **OTLP.** Request bodies are limited to 4 MiB, and to 16 MiB after gzip decompression.
- **Ports.** `npx llmflow` and `bun run start` fail if a port is taken. The development commands
  pick a free port instead and print it.

---

## Development

LLMFlow is a Bun workspaces monorepo: the server (`apps/server`, published to npm as `llmflow`),
the Svelte dashboard (`apps/dashboard`), seven packages under `packages/` and the Playwright suite
in `e2e/playwright`. [ARCHITECTURE.md](ARCHITECTURE.md) describes how they fit together.

Bun (1.3.13 or newer; CI and Docker use the version in `.bun-version`) installs, builds, tests and
runs the server. Node.js is needed for the `npx` launcher and for Node-based tools (Vite, Vitest,
Playwright, `npm pack`).

```bash
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow && bun install
bun run dev
```

`bun run dev` starts the server and the Vite dashboard with hot reload, and prints their URLs.
Open the Vite URL (5173 by default); it proxies `/api` and `/ws` to the server.

| Command                                | What it does                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `bun run dev`                          | Server and Vite dashboard together, on free ports if the preferred ones are taken |
| `bun run dev:server` / `dev:dashboard` | One side only, in its own terminal; the dashboard finds the running server        |
| `bun run dev:status`                   | The development servers running from this checkout                                |
| `bun run demo` / `demo:many`           | Send sample traces, logs and metrics to the running server (`--count=N` loops)    |
| `bun run start`                        | Run the server from source                                                        |
| `bun run build`                        | Build the dashboard and the bundled server into `apps/server/dist/`               |
| `bun run check`                        | Typecheck every workspace, lint (oxlint) and check formatting (oxfmt)             |
| `bun run format`                       | Format the repository                                                             |
| `bun run test`                         | Server, package and dashboard tests                                               |
| `bun run test:e2e`                     | Playwright tests against a built, seeded server                                   |
| `bun run test:live`                    | Tests against real provider APIs (billable; skipped without keys)                 |
| `bun run test:package`                 | Pack `llmflow` and `llmflow-sdk` and test the tarballs in a clean project         |
| `bun run env:docs`                     | Regenerate the configuration docs from `packages/shared/src/config.ts`            |
| `bun run pricing:refresh`              | Regenerate the bundled pricing fallback from LiteLLM                              |

`just --list` shows the same commands as `just` recipes, with `-` for `:` (`just dev-server`); `just check` also
runs the tests, and `just test <path>` runs only matching server and package test files.

### Tests

`bun run test` needs no network or API keys: every server test starts its own server on free ports
with a temporary database. Run `bunx playwright install chromium` once before `bun run test:e2e`.

`bun run test:live` makes real, billable requests. A provider runs only when its API key is set;
`PROVIDERS=openai,anthropic` restricts the run, and `LLMFLOW_TEST_<PROVIDER>_MODEL` overrides a
model (defaults in [`live-providers.ts`](apps/server/test/helpers/live-providers.ts)). Upstream
authentication, quota and billing errors fail the test instead of being skipped.

To include the Python OpenTelemetry protobuf/gzip integration test, install `opentelemetry-sdk` and
`opentelemetry-exporter-otlp-proto-http`, then run `LLMFLOW_PYTHON=python3 bun run test`.

### Development ports

`DASHBOARD_PORT`, `PROXY_PORT` and `VITE_PORT` set the preferred ports (1337, 8080, 5173). When one
is taken, the development commands use a free port and print it. Servers started from the same
checkout find each other through a per-checkout directory, so `bun run dev:dashboard` connects to a
`bun run dev:server` in another terminal, even after it restarts on a new port. Set `LLMFLOW_URL`
to point the dashboard dev server or the demo at another server.

### Packaging

The npm package is built from `apps/server`: `bun run build` bundles the server into
`dist/server.js` and copies the dashboard into `dist/public/`. The `llmflow` launcher
(`apps/server/bin/llmflow.js`) runs `src/server.ts` in a checkout and `dist/server.js` in an npm
install. Docker builds the same layout from source.

---

## License

MIT © [Helge Sverre](https://github.com/HelgeSverre)
