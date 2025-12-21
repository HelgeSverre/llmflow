# Observability Backend Examples

This folder contains example configurations for integrating LLMFlow with popular observability platforms.

## Quick Reference

| Backend                 | Docker Compose | Script | Description                     |
| ----------------------- | -------------- | ------ | ------------------------------- |
| [Jaeger](./jaeger/)     | ✅             | ✅     | Open-source distributed tracing |
| [Phoenix](./phoenix/)   | ✅             | ✅     | Arize's LLM observability       |
| [Langfuse](./langfuse/) | ✅             | ✅     | LLM monitoring & prompts        |
| [Helicone](./helicone/) | -              | ✅     | LLM cost tracking               |
| [Opik](./opik/)         | ✅             | ✅     | Comet experiment tracking       |

## Setup

1. Start LLMFlow:

   ```bash
   cd ../..
   npm start
   ```

2. Start your observability backend:

   ```bash
   cd jaeger  # or phoenix, langfuse, etc.
   docker compose up -d
   ```

3. Configure LLMFlow to export traces:

   ```bash
   # Add to .env
   OTLP_EXPORT_ENDPOINT=http://localhost:4318/v1/traces
   ```

4. Run example:

   ```bash
   node test.js
   ```

5. View traces:
   - Jaeger: http://localhost:16686
   - Phoenix: http://localhost:6006
   - Langfuse: http://localhost:3000
   - LLMFlow: http://localhost:3000

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                        │
│                                                             │
│   const client = new OpenAI({                               │
│       baseURL: 'http://localhost:8080/v1'  // LLMFlow      │
│   });                                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                       LLMFlow                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Proxy     │───▶│  Dashboard  │───▶│ OTLP Export │     │
│  │   :8080     │    │   :3000     │    │  (batched)  │     │
│  └──────┬──────┘    └─────────────┘    └──────┬──────┘     │
│         │                                      │            │
└─────────┼──────────────────────────────────────┼────────────┘
          │                                      │
          ▼                                      ▼
   ┌──────────────┐                    ┌──────────────────┐
   │   LLM APIs   │                    │ Observability    │
   │ OpenAI, etc  │                    │ Jaeger, Phoenix  │
   └──────────────┘                    │ Langfuse, etc    │
                                       └──────────────────┘
```

## Environment Variables

| Variable                       | Description                    | Example                             |
| ------------------------------ | ------------------------------ | ----------------------------------- |
| `OTLP_EXPORT_ENDPOINT`         | Primary OTLP endpoint          | `http://localhost:4318/v1/traces`   |
| `OTLP_EXPORT_TRACES_ENDPOINT`  | Traces-specific endpoint       | `http://jaeger:4318/v1/traces`      |
| `OTLP_EXPORT_LOGS_ENDPOINT`    | Logs-specific endpoint         | `http://loki:3100/v1/logs`          |
| `OTLP_EXPORT_METRICS_ENDPOINT` | Metrics-specific endpoint      | `http://prometheus:9090/v1/metrics` |
| `OTLP_EXPORT_HEADERS`          | Auth headers (comma-separated) | `Authorization=Bearer xxx`          |
| `OTLP_EXPORT_BATCH_SIZE`       | Batch size before flush        | `100`                               |
| `OTLP_EXPORT_FLUSH_INTERVAL`   | Flush interval (ms)            | `5000`                              |

## Backend-Specific Notes

### Jaeger

- No authentication required for local development
- Supports OTLP/HTTP natively
- UI shows full trace timelines

### Phoenix (Arize)

- Free tier available at https://app.phoenix.arize.com
- Specialized for LLM/ML traces
- Built-in evaluation features

### Langfuse

- Supports OTLP as of recent versions
- Also has REST API for programmatic access
- Prompt management features

### Helicone

- Works as a proxy (not OTLP export)
- Use `/passthrough/helicone/*` routes
- Cost tracking and caching features

### Opik (Comet)

- Free tier available
- Experiment tracking and comparison
- Supports custom metrics
