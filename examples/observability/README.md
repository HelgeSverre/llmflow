# Observability Backend Examples

This folder contains example configurations for integrating LLMFlow with popular observability platforms.

## Quick Reference

| Backend                 | How it runs                                       | UI                       |
| ----------------------- | ------------------------------------------------- | ------------------------ |
| [Jaeger](./jaeger/)     | `docker compose up -d` in its folder              | <http://localhost:16686> |
| [Phoenix](./phoenix/)   | `docker compose up -d` in its folder              | <http://localhost:6006>  |
| [Langfuse](./langfuse/) | Langfuse's own `docker-compose.yml` with settings | <http://127.0.0.1:3000>  |
| [Opik](./opik/)         | Opik's `opik.sh` launcher                         | <http://127.0.0.1:5173>  |

Each folder's README has the start command, the LLMFlow settings (also in its `.env.example`) and
a way to check that spans arrived.

## Setup

1. Start the backend as its README describes.
2. Copy the settings from its `.env.example` into the project-root `.env`.
3. Start LLMFlow from the project root:

   ```bash
   bun run start
   ```

4. Send some traffic through LLMFlow, for example with `bun run demo` from the project root or
   the [RAG pipeline example](../rag-pipeline/).
5. Open the backend's UI, and LLMFlow's dashboard at <http://127.0.0.1:1337>.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                        │
│                                                             │
│   const client = new OpenAI({                               │
│       baseURL: 'http://127.0.0.1:8080/v1'  // LLMFlow      │
│   });                                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                       LLMFlow                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Proxy     │───▶│  Dashboard  │───▶│ OTLP Export │     │
│  │   :8080     │    │   :1337     │    │  (batched)  │     │
│  └──────┬──────┘    └─────────────┘    └──────┬──────┘     │
│         │                                      │            │
└─────────┼──────────────────────────────────────┼────────────┘
          │                                      │
          ▼                                      ▼
   ┌──────────────┐                    ┌──────────────────┐
   │   LLM APIs   │                    │ Observability    │
   │ OpenAI, etc  │                    │ Jaeger, Phoenix  │
   └──────────────┘                    │ Langfuse, Opik   │
                                       └──────────────────┘
```

## Environment Variables

| Variable                        | Description                    | Example                             |
| ------------------------------- | ------------------------------ | ----------------------------------- |
| `OTLP_EXPORT_ENDPOINT`          | Primary OTLP endpoint          | `http://localhost:4318/v1/traces`   |
| `OTLP_EXPORT_TRACES_ENDPOINT`   | Traces-specific endpoint       | `http://jaeger:4318/v1/traces`      |
| `OTLP_EXPORT_LOGS_ENDPOINT`     | Logs-specific endpoint         | `http://loki:3100/v1/logs`          |
| `OTLP_EXPORT_METRICS_ENDPOINT`  | Metrics-specific endpoint      | `http://prometheus:9090/v1/metrics` |
| `OTLP_EXPORT_HEADERS`           | Auth headers (comma-separated) | `Authorization=Bearer xxx`          |
| `OTLP_EXPORT_PROTOCOL`          | `http/json` or `http/protobuf` | `http/protobuf` (Phoenix)           |
| `OTLP_EXPORT_BATCH_SIZE`        | Batch size before flush        | `100`                               |
| `OTLP_EXPORT_FLUSH_INTERVAL_MS` | Flush interval (ms)            | `5000`                              |

## Backend-Specific Notes

- **Jaeger** needs no authentication locally and shows full trace timelines.
- **Phoenix** needs `OTLP_EXPORT_PROTOCOL=http/protobuf`.
- **Langfuse** authenticates with Basic auth built from the project's public and secret keys.
- **Opik** picks the project from the `projectName` header and maps a span's conversation ID to
  its thread.
