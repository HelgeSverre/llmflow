# LLMFlow

**Local LLM observability. One command. No signup. No cloud.**

Track costs, tokens, and latency for OpenAI, Anthropic, Gemini, Ollama, and more.

## Quick Start

```bash
docker run -p 3000:3000 -p 8080:8080 helgesverre/llmflow
```

Then point your SDK at `http://localhost:8080/v1` and open `http://localhost:3000` to view traces.

## Ports

| Port | Description                   |
| ---- | ----------------------------- |
| 3000 | Web dashboard & OTLP receiver |
| 8080 | LLM proxy server              |

## Persistent Storage

Mount a volume to persist your data (the container's data dir is `/root/.llmflow`):

```bash
docker run -p 3000:3000 -p 8080:8080 \
  -v llmflow-data:/root/.llmflow \
  helgesverre/llmflow
```

## Environment Variables

| Variable         | Default             | Description                               |
| ---------------- | ------------------- | ----------------------------------------- |
| `DASHBOARD_PORT` | `3000`              | Dashboard + OTLP receiver port            |
| `PROXY_PORT`     | `8080`              | Proxy server port                         |
| `DATA_DIR`       | `/root/.llmflow`    | SQLite + WAL directory                    |
| `DB_PATH`        | `$DATA_DIR/data.db` | Override the SQLite file path             |
| `MAX_TRACES`     | `10000`             | Trace-retention cap (older traces pruned) |

## Supported Providers

Route your LLM requests through LLMFlow:

- **OpenAI**: `http://localhost:8080/v1`
- **Anthropic**: `http://localhost:8080/anthropic/v1`
- **Gemini**: `http://localhost:8080/gemini/v1`
- **Ollama**: `http://localhost:8080/ollama/v1`
- **Groq**: `http://localhost:8080/groq/v1`
- **Mistral**: `http://localhost:8080/mistral/v1`
- **Azure OpenAI**: `http://localhost:8080/azure/v1`
- **Together**: `http://localhost:8080/together/v1`
- **OpenRouter**: `http://localhost:8080/openrouter/v1`

## OpenTelemetry

LLMFlow accepts OTLP/HTTP traces, logs, and metrics:

- Traces: `http://localhost:3000/v1/traces`
- Logs: `http://localhost:3000/v1/logs`
- Metrics: `http://localhost:3000/v1/metrics`

## Links

- [Documentation](https://llmflow.dev)
- [GitHub](https://github.com/HelgeSverre/llmflow)
- [npm Package](https://www.npmjs.com/package/llmflow)

## License

MIT
