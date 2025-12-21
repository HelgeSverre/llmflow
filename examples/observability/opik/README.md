# Opik (Comet) Integration

[Opik](https://www.comet.com/docs/opik) is Comet's open-source LLM observability and experiment tracking platform.

## Quick Start

1. Start Opik:

   ```bash
   docker compose up -d
   ```

   **Note**: Opik has a slow startup time (30-60 seconds). Wait for it to be ready.

2. Create account at http://localhost:5173:
   - Sign up with email/password
   - Create a project
   - Get your API key from settings

3. Configure LLMFlow (add to `.env` in project root):

   ```bash
   OTLP_EXPORT_ENDPOINT=http://localhost:8081/api/v1/private/otel/v1/traces
   # OTLP_EXPORT_HEADERS=Authorization=your-api-key,projectName=your-project
   ```

4. Restart LLMFlow:

   ```bash
   npm start
   ```

5. Make some LLM requests through the proxy

6. View traces:
   - **Opik UI**: http://localhost:5173
   - **LLMFlow Dashboard**: http://localhost:3000

## Comet Cloud

For the hosted version at https://www.comet.com/opik:

```bash
OTLP_EXPORT_ENDPOINT=https://www.comet.com/opik/api/v1/private/otel/v1/traces
OTLP_EXPORT_HEADERS=Authorization=your-api-key,projectName=your-project,Comet-Workspace=your-workspace
```

## Features

Opik provides:

- LLM trace visualization
- Experiment tracking and comparison
- Dataset management
- Evaluation pipelines
- Production monitoring
- Custom dashboards
- Guardrails and alerts

## Trace Attributes

LLMFlow exports these attributes:

- `gen_ai.system` - Provider
- `gen_ai.request.model` - Model name
- `gen_ai.usage.*` - Token counts
- `llmflow.cost` - Estimated cost
- `llmflow.span_type` - Operation type

## Cleanup

```bash
docker compose down -v
```
