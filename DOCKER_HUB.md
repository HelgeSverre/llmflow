# LLMFlow

**Local LLM observability. One command. No signup. No cloud.**

Track costs, tokens, and latency for OpenAI, Anthropic, Gemini, Ollama, and more.

## Quick Start

```bash
docker run -p 127.0.0.1:1337:1337 -p 127.0.0.1:8080:8080 helgesverre/llmflow
```

Then point your SDK at `http://localhost:8080/v1` and open `http://localhost:1337` to view traces.

The image is built for `linux/amd64` and `linux/arm64`.

## Ports

| Port | Description                   |
| ---- | ----------------------------- |
| 1337 | Web dashboard & OTLP receiver |
| 8080 | LLM proxy server              |

Inside the container both listeners bind to `0.0.0.0` (`DASHBOARD_HOST` and `PROXY_HOST`), so publish them on host loopback as above. LLMFlow has no authentication: dropping the `127.0.0.1:` prefix exposes the proxy, and the provider keys behind it, to your network.

## Persistent Storage

The container runs as the non-root user `bun` (uid/gid 1000) and keeps its data in `/home/bun/.llmflow`. Mount a volume there to persist it:

```bash
docker run -p 127.0.0.1:1337:1337 -p 127.0.0.1:8080:8080 \
  -v llmflow-data:/home/bun/.llmflow \
  helgesverre/llmflow
```

A bind mount must be writable by uid 1000.

### Migrating from `/root/.llmflow`

Images up to 0.4.1 ran as root with the data directory at `/root/.llmflow`. To keep an existing volume, give it to uid 1000 once and mount it at the new path:

```bash
docker run --rm -u 0 -v llmflow-data:/data --entrypoint chown helgesverre/llmflow -R 1000:1000 /data
docker run -p 127.0.0.1:1337:1337 -p 127.0.0.1:8080:8080 \
  -v llmflow-data:/home/bun/.llmflow \
  helgesverre/llmflow
```

A volume still mounted at `/root/.llmflow` is ignored: the server reads `DATA_DIR=/home/bun/.llmflow` and starts with an empty database.

## Environment Variables

| Variable         | Default              | Description                                 |
| ---------------- | -------------------- | ------------------------------------------- |
| `DASHBOARD_PORT` | `1337`               | Dashboard + OTLP receiver port              |
| `PROXY_PORT`     | `8080`               | Proxy server port                           |
| `DASHBOARD_HOST` | `0.0.0.0`            | Dashboard bind address inside the container |
| `PROXY_HOST`     | `0.0.0.0`            | Proxy bind address inside the container     |
| `DATA_DIR`       | `/home/bun/.llmflow` | SQLite + WAL directory                      |
| `DB_PATH`        | `$DATA_DIR/data.db`  | Override the SQLite file path               |
| `MAX_TRACES`     | `10000`              | Trace-retention cap (older traces pruned)   |

Provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and so on) are read from the container environment; pass them with `-e` or `--env-file`.

## Supported Providers

Route your LLM requests through LLMFlow with a path prefix or the `X-LLMFlow-Provider` header:

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

To reach an Ollama server on the Docker host, set `OLLAMA_HOST=host.docker.internal` (on Linux, also add `--add-host=host.docker.internal:host-gateway`).

## OpenTelemetry

LLMFlow accepts OTLP/HTTP traces, logs, and metrics:

- Traces: `http://localhost:1337/v1/traces`
- Logs: `http://localhost:1337/v1/logs`
- Metrics: `http://localhost:1337/v1/metrics`

## Health Check

`GET http://localhost:1337/api/health` returns `{"status":"ok",...}`. The image's `HEALTHCHECK` polls it.

## Links

- [Website](https://www.llmflow.app)
- [GitHub](https://github.com/HelgeSverre/llmflow)
- [npm Package](https://www.npmjs.com/package/llmflow)

## License

MIT
