# Langfuse

Forward what LLMFlow records to a local [Langfuse](https://langfuse.com), running Langfuse's own
self-hosting setup.

## Start Langfuse

From this directory, download Langfuse's `docker-compose.yml` and start it:

```bash
cd examples/observability/langfuse
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/langfuse/langfuse/main/docker-compose.yml
docker compose --env-file langfuse.env up -d
```

- `langfuse.env` uses Langfuse's headless initialisation to create an organisation, a project
  with fixed API keys (`pk-lf-llmflow-local` / `sk-lf-llmflow-local`) and a login
  (`admin@llmflow.local` / `llmflow-local`), so there is nothing to set up in the UI.
- `docker-compose.override.yml`, which Compose merges automatically, keeps Postgres, Redis and
  ClickHouse off host ports so they cannot clash with databases already running on your machine.
  Only the UI and API (3000) and MinIO (9090) are published.
- The downloaded `docker-compose.yml` is gitignored. Its secrets are Langfuse's local defaults; do
  not expose this stack to a network.

Langfuse is ready when `curl http://127.0.0.1:3000/api/public/health` returns `"status":"OK"`
(about a minute on the first start, while images download).

## Point LLMFlow at it

Start LLMFlow with the settings in [`.env.example`](.env.example), for example by copying them
into the project-root `.env`:

```bash
OTLP_EXPORT_TRACES_ENDPOINT=http://127.0.0.1:3000/api/public/otel/v1/traces
OTLP_EXPORT_HEADERS="Authorization=Basic cGstbGYtbGxtZmxvdy1sb2NhbDpzay1sZi1sbG1mbG93LWxvY2Fs"
```

The header is `base64("<public key>:<secret key>")`. For a different project, encode its keys:

```bash
printf 'pk-lf-...:sk-lf-...' | base64
```

## Check it

Send traffic through LLMFlow (or `bun run demo` from the repository root), then open
<http://127.0.0.1:3000>, log in and open the LLMFlow project. Spans arrive as observations with
their model, token usage, session and LLMFlow's attributes as metadata. To check from the command
line:

```bash
curl -s -u pk-lf-llmflow-local:sk-lf-llmflow-local \
  "http://127.0.0.1:3000/api/public/v2/observations?limit=5&fields=core,basic,usage,model"
```

## Stop

```bash
docker compose down      # keep the data
docker compose down -v   # delete it
```

Checked with Langfuse 4.43 (2026-09-23).
