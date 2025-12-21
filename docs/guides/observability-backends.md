# Observability Backends Integration Guide

LLMFlow can integrate with popular LLM observability platforms, either by:

1. **Exporting data TO backends** - Configure LLMFlow to forward traces/logs/metrics
2. **Receiving data FROM tools** - Accept OTLP telemetry from instrumented applications
3. **Acting as a proxy** - Forward LLM requests while capturing telemetry

## Quick Reference

| Platform            | Integration Method | Port      | Endpoint                                              |
| ------------------- | ------------------ | --------- | ----------------------------------------------------- |
| **Jaeger**          | OTLP Export        | 4318      | `http://localhost:4318/v1/traces`                     |
| **Phoenix (Arize)** | OTLP Export        | 6006/6007 | `http://localhost:6006/v1/traces`                     |
| **Langfuse**        | OTLP Export        | 3000      | `http://localhost:3000/api/public/otel/v1/traces`     |
| **Helicone**        | Proxy Mode         | 8585      | `http://localhost:8585/v1/chat/completions`           |
| **Opik (Comet)**    | OTLP Export        | 5173      | `http://localhost:5173/api/v1/private/otel/v1/traces` |
| **Zipkin**          | Zipkin Format      | 9411      | `http://localhost:9411/api/v2/spans`                  |
| **Grafana Tempo**   | OTLP Export        | 4318      | `http://localhost:4318/v1/traces`                     |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Your Application                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  OpenAI SDK  │  │ LangChain    │  │ Custom Code  │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                 │                           │
│         └─────────────────┼─────────────────┘                           │
│                           │                                             │
│                           ▼                                             │
│                    ┌──────────────┐                                     │
│                    │   LLMFlow    │──────────────────────────────┐      │
│                    │   Proxy      │                              │      │
│                    │  :8080       │                              │      │
│                    └──────┬───────┘                              │      │
│                           │                                      │      │
│         ┌─────────────────┼─────────────────────────┐           │      │
│         ▼                 ▼                         ▼           │      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │      │
│  │   OpenAI     │  │  Anthropic   │  │   Gemini     │          │      │
│  └──────────────┘  └──────────────┘  └──────────────┘          │      │
│                                                                 │      │
└─────────────────────────────────────────────────────────────────┼──────┘
                                                                  │
                                                                  ▼
                                                     ┌──────────────────┐
                                                     │   LLMFlow        │
                                                     │   Dashboard      │
                                                     │   :3000          │
                                                     └────────┬─────────┘
                                                              │
                        ┌─────────────────────────────────────┼─────────────────────┐
                        │                                     │                     │
                        ▼                                     ▼                     ▼
                 ┌──────────────┐                    ┌──────────────┐      ┌──────────────┐
                 │   Jaeger     │                    │   Langfuse   │      │   Phoenix    │
                 │   :16686     │                    │   Cloud      │      │   :6006      │
                 └──────────────┘                    └──────────────┘      └──────────────┘
```

---

## Jaeger

[Jaeger](https://www.jaegertracing.io/) is an open-source distributed tracing system.

### Setup

```bash
# Start Jaeger with OTLP support
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

### Configuration

**Option A: Export from LLMFlow to Jaeger**

Set environment variables to forward traces:

```bash
export OTLP_EXPORT_ENDPOINT=http://localhost:4318/v1/traces
export OTLP_EXPORT_ENABLED=true
```

**Option B: Send OTLP traces through LLMFlow**

LLMFlow accepts OTLP at `/v1/traces`. Configure your app to send to LLMFlow, then set up forwarding:

```javascript
// Example: Configure OpenTelemetry SDK
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");

const exporter = new OTLPTraceExporter({
  url: "http://localhost:3000/v1/traces", // LLMFlow dashboard
});
```

### View Traces

- **Jaeger UI**: http://localhost:16686
- **LLMFlow Dashboard**: http://localhost:3000

---

## Phoenix (Arize)

[Phoenix](https://phoenix.arize.com/) is Arize's open-source LLM observability tool.

### Setup

```bash
# Start Phoenix locally
docker run -d --name phoenix \
  -p 6006:6006 \
  -p 6007:6007 \
  arizephoenix/phoenix:latest
```

Or use their hosted cloud at https://app.phoenix.arize.com

### Configuration

Phoenix accepts OTLP traces. Configure your application to send traces to Phoenix:

```bash
# Environment variables for Phoenix
export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:6006
```

**Using with LLMFlow Proxy**

```javascript
// Configure OpenTelemetry to send to Phoenix
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");

// Send to Phoenix directly
const phoenixExporter = new OTLPTraceExporter({
  url: "http://localhost:6006/v1/traces",
});

// Or send to LLMFlow (which stores locally)
const llmflowExporter = new OTLPTraceExporter({
  url: "http://localhost:3000/v1/traces",
});
```

### Arize Cloud

For Arize's cloud platform:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.arize.com/v1
export OTEL_EXPORTER_OTLP_HEADERS="space_id=your-space-id,api_key=your-api-key"
```

---

## Langfuse

[Langfuse](https://langfuse.com/) provides LLM observability with prompt management.

### Setup

```bash
# Start Langfuse locally
docker compose up -d

# Or use Langfuse Cloud
# https://cloud.langfuse.com
```

### Configuration

Langfuse now supports OpenTelemetry ingestion:

**OTLP Endpoint (Recommended)**

```bash
# Self-hosted
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000/api/public/otel/v1/traces

# Langfuse Cloud US
export OTEL_EXPORTER_OTLP_ENDPOINT=https://us.cloud.langfuse.com/api/public/otel/v1/traces

# Langfuse Cloud EU
export OTEL_EXPORTER_OTLP_ENDPOINT=https://cloud.langfuse.com/api/public/otel/v1/traces

# Authentication (Basic Auth)
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $(echo -n 'pk_xxx:sk_xxx' | base64)"
```

**REST API (Legacy)**

```javascript
// Using Langfuse SDK
import Langfuse from "langfuse";

const langfuse = new Langfuse({
  publicKey: "pk_xxx",
  secretKey: "sk_xxx",
  baseUrl: "http://localhost:3000", // or cloud URL
});
```

### Using LLMFlow with Langfuse

You can use both LLMFlow and Langfuse together:

1. **LLMFlow as primary observability** - Local dashboard + SQLite storage
2. **Forward to Langfuse** - For prompt management and team collaboration

```bash
# Your app → LLMFlow Proxy → OpenAI
# LLMFlow → Langfuse (via OTLP export)
```

---

## Helicone

[Helicone](https://helicone.ai/) provides LLM cost tracking and analytics.

### Integration Method: Proxy Chain

Helicone works as a proxy, so you chain LLMFlow → Helicone → Provider:

```
Your App → LLMFlow Proxy → Helicone Gateway → OpenAI
```

### Configuration

**Option A: Helicone Cloud**

```bash
# Configure your OpenAI client
export OPENAI_BASE_URL=https://oai.helicone.ai/v1
export HELICONE_API_KEY=sk-helicone-xxx
```

**Option B: Self-hosted Helicone**

```bash
# Start Helicone
docker compose up -d

# Gateway available at localhost:8585
export OPENAI_BASE_URL=http://localhost:8585/v1/gateway/oai/v1
```

### Using with LLMFlow

```javascript
// Chain: App → LLMFlow → Helicone → OpenAI
const client = new OpenAI({
  baseURL: "http://localhost:8080/v1", // LLMFlow proxy
  defaultHeaders: {
    "X-LLMFlow-Forward-URL": "https://oai.helicone.ai/v1",
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});
```

Or configure LLMFlow to use Helicone as the upstream provider:

```bash
# In LLMFlow .env
OPENAI_BASE_URL=https://oai.helicone.ai/v1
OPENAI_DEFAULT_HEADERS='{"Helicone-Auth": "Bearer sk-helicone-xxx"}'
```

---

## Opik (Comet)

[Opik](https://www.comet.com/docs/opik) is Comet's open-source LLM observability platform.

### Setup

```bash
# Self-hosted with Docker
docker compose up -d

# UI available at http://localhost:5173
```

Or use Comet Cloud at https://www.comet.com/opik

### Configuration

Opik supports OpenTelemetry:

```bash
# Self-hosted
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:5173/api/v1/private/otel

# Comet Cloud
export OTEL_EXPORTER_OTLP_ENDPOINT=https://www.comet.com/opik/api/v1/private/otel
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=your-api-key,projectName=your-project,Comet-Workspace=your-workspace"
```

### Using with LLMFlow

```python
# Python example with Opik decorator
import opik
from openai import OpenAI

# Configure to use LLMFlow proxy
client = OpenAI(
    base_url='http://localhost:8080/v1'  # LLMFlow proxy
)

@opik.track
def my_llm_function(prompt: str):
    response = client.chat.completions.create(
        model='gpt-4o-mini',
        messages=[{'role': 'user', 'content': prompt}]
    )
    return response.choices[0].message.content
```

---

## Zipkin

[Zipkin](https://zipkin.io/) is a distributed tracing system.

### Setup

```bash
docker run -d --name zipkin \
  -p 9411:9411 \
  openzipkin/zipkin
```

### Configuration

Zipkin uses its own format (not OTLP). You'll need a Zipkin exporter:

```javascript
const { ZipkinExporter } = require("@opentelemetry/exporter-zipkin");

const exporter = new ZipkinExporter({
  url: "http://localhost:9411/api/v2/spans",
  serviceName: "my-llm-app",
});
```

### View Traces

- **Zipkin UI**: http://localhost:9411

---

## Grafana Tempo

[Grafana Tempo](https://grafana.com/oss/tempo/) is a high-scale distributed tracing backend.

### Setup

```bash
# Using Grafana's docker-compose example
docker compose -f tempo/docker-compose.yaml up -d
```

### Configuration

Tempo accepts OTLP:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

---

## Multi-Backend Setup

You can send traces to multiple backends simultaneously:

### Using OpenTelemetry Collector

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true
  otlp/phoenix:
    endpoint: phoenix:4317
    tls:
      insecure: true
  otlphttp/langfuse:
    endpoint: https://cloud.langfuse.com/api/public/otel
    headers:
      Authorization: "Basic ${LANGFUSE_AUTH}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/jaeger, otlp/phoenix, otlphttp/langfuse]
```

### Using LLMFlow as Hub

```
                     ┌─────────────┐
                     │   LLMFlow   │
App → LLMFlow Proxy →│  Dashboard  │→ SQLite (local)
                     │   :3000     │
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         ┌────────┐   ┌──────────┐  ┌──────────┐
         │ Jaeger │   │ Langfuse │  │ Phoenix  │
         └────────┘   └──────────┘  └──────────┘
```

Configure export destinations in LLMFlow (future feature).

---

## Troubleshooting

### Common Issues

**1. Connection Refused**

```bash
# Check if service is running
docker ps | grep jaeger

# Test endpoint
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[]}'
```

**2. Authentication Errors**

Most backends require API keys. Check your headers:

```bash
# Langfuse: Basic Auth
Authorization: Basic base64(public_key:secret_key)

# Opik: Bearer token
Authorization: your-api-key

# Helicone: Custom header
Helicone-Auth: Bearer sk-helicone-xxx
```

**3. Missing Traces**

- Ensure OTLP protocol is HTTP/JSON (not gRPC)
- Check `Content-Type: application/json` header
- Verify trace data structure matches OTLP spec

### Debug Mode

Enable verbose logging in LLMFlow:

```bash
VERBOSE=1 npm start
```

---

## See Also

- [AI CLI Tools Integration](./ai-cli-tools.md) - Claude Code, Codex CLI, etc.
- [OTLP Endpoints](../rfcs/metrics-and-logs.md) - Technical specification
- [Passthrough Mode](../rfcs/passthrough-mode.md) - Native API forwarding
