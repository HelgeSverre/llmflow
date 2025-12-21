# LLMFlow v0.3.0

**Universal observability for AI coding assistants**

This release makes LLMFlow the go-to observability backend for AI-assisted development, supporting all major AI CLI tools out of the box.

## ✨ Highlights

- **AI CLI Tools Support** - Claude Code, Codex CLI, Gemini CLI, and Aider work seamlessly
- **OTLP Logs & Metrics** - Full OpenTelemetry support beyond just traces
- **OTLP Export** - Forward traces/logs/metrics to Jaeger, Phoenix, Langfuse, Opik
- **Passthrough Proxy Mode** - Forward native API formats while capturing telemetry
- **Helicone Integration** - Cost tracking via Helicone passthrough
- **Analytics Dashboard** - Token usage trends and cost analytics by tool/model
- **Unified Timeline** - See all AI activity from all tools in one view

## 🚀 Quick Start

```bash
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow
npm install && npm start
```

- Dashboard: http://localhost:3000
- Proxy: http://localhost:8080

## 📦 New Features

### OTLP Logs Endpoint

Accept log telemetry from AI CLI tools:

```bash
# Codex CLI config (~/.codex/config.toml)
[otel.exporter."otlp-http"]
endpoint = "http://localhost:3000/v1/logs"
```

### OTLP Metrics Endpoint

Capture token usage and performance metrics:

```bash
# Gemini CLI / Claude Code
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000
```

### Passthrough Proxy Mode

For AI tools using native API formats:

```bash
# Claude Code - passthrough mode
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic

# Gemini CLI - passthrough mode
export GEMINI_API_BASE=http://localhost:8080/passthrough/gemini
```

| Provider  | Passthrough Path           |
| --------- | -------------------------- |
| Anthropic | `/passthrough/anthropic/*` |
| Gemini    | `/passthrough/gemini/*`    |
| OpenAI    | `/passthrough/openai/*`    |
| Helicone  | `/passthrough/helicone/*`  |

### OTLP Export to External Backends

Forward telemetry to external observability platforms:

```bash
# Export to Jaeger
OTLP_EXPORT_ENDPOINT=http://localhost:4318/v1/traces

# Export to Langfuse (with auth)
OTLP_EXPORT_ENDPOINT=https://cloud.langfuse.com/api/public/otel/v1/traces
OTLP_EXPORT_HEADERS=Authorization=Basic base64(pk:sk)
```

Supported backends: Jaeger, Phoenix (Arize), Langfuse, Opik (Comet), Grafana Tempo.

### Custom Tags

Add custom tags to traces for better filtering:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "X-LLMFlow-Tag: user:alice, env:prod" \
  -d '{"model":"gpt-4o-mini","messages":[...]}'
```

### Analytics Dashboard

New Analytics tab with:

- **Token Usage Trends** - Daily token consumption chart
- **Cost by Tool** - Spend breakdown by AI tool (Claude, Codex, Gemini, Aider)
- **Cost by Model** - Spend breakdown by LLM model
- **Daily Summary** - Table of requests, tokens, and costs per day

### Unified Timeline

New Timeline tab showing:

- All traces, logs, and metrics in chronological order
- Tool-specific icons and colors
- Filter by tool (Claude Code, Codex CLI, Gemini CLI, Aider)
- Filter by type (Trace, Log, Metric)
- Related logs correlation via trace_id

## 🔧 AI CLI Tool Setup

### Claude Code

```bash
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic
claude
```

### Codex CLI

```toml
# ~/.codex/config.toml
[otel.exporter."otlp-http"]
endpoint = "http://localhost:3000/v1/logs"
```

### Gemini CLI

```json
// ~/.gemini/settings.json
{ "telemetry": { "otlpEndpoint": "http://localhost:3000" } }
```

### Aider

```bash
aider --openai-api-base http://localhost:8080/v1
```

## 📊 New API Endpoints

| Endpoint                           | Description                     |
| ---------------------------------- | ------------------------------- |
| `POST /v1/logs`                    | OTLP/HTTP log ingestion         |
| `POST /v1/metrics`                 | OTLP/HTTP metrics ingestion     |
| `GET /api/traces/export`           | Export traces as JSON/JSONL     |
| `GET /api/health/providers`        | Check provider API key validity |
| `GET /api/analytics/token-trends`  | Token usage over time           |
| `GET /api/analytics/cost-by-tool`  | Cost breakdown by tool          |
| `GET /api/analytics/cost-by-model` | Cost breakdown by model         |
| `GET /api/analytics/daily`         | Daily summary stats             |

## 🧪 Test Coverage

- **103+ unit tests** passing
- **210+ total tests** including E2E
- Provider tests, passthrough tests, analytics tests, OTLP tests

```bash
make test
```

## 📖 Documentation

- [AI CLI Tools Guide](docs/guides/ai-cli-tools.md)
- [Observability Backends Guide](docs/guides/observability-backends.md)
- [Examples](examples/) - Setup guides for each tool
- [README](README.md)

## 🔄 Migration from v0.2.x

No breaking changes. The new features are additive:

- Database schema auto-migrates (adds logs and metrics tables)
- Existing proxy routes continue to work
- New passthrough routes are available at `/passthrough/*`

## 📄 License

MIT © Helge Sverre
