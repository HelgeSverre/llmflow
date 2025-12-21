# Jaeger Integration

[Jaeger](https://www.jaegertracing.io/) is an open-source distributed tracing system.

## Quick Start

1. Start Jaeger:

   ```bash
   docker compose up -d
   ```

2. Configure LLMFlow (add to `.env` in project root):

   ```bash
   OTLP_EXPORT_ENDPOINT=http://localhost:4318/v1/traces
   ```

3. Restart LLMFlow:

   ```bash
   npm start
   ```

4. Make some LLM requests through the proxy

5. View traces:
   - **Jaeger UI**: http://localhost:16686
   - **LLMFlow Dashboard**: http://localhost:3000

## Configuration

| Environment Variable   | Value                             | Description               |
| ---------------------- | --------------------------------- | ------------------------- |
| `OTLP_EXPORT_ENDPOINT` | `http://localhost:4318/v1/traces` | Jaeger OTLP HTTP endpoint |

## Viewing Traces

1. Open http://localhost:16686
2. Select "llmflow" from the Service dropdown
3. Click "Find Traces"

## Trace Attributes

LLMFlow exports these OpenTelemetry attributes:

- `gen_ai.system` - Provider (openai, anthropic, etc.)
- `gen_ai.request.model` - Model name
- `gen_ai.usage.prompt_tokens` - Input tokens
- `gen_ai.usage.completion_tokens` - Output tokens
- `llmflow.cost` - Estimated cost in USD
- `llmflow.span_type` - Type (llm, chain, tool, etc.)

## Cleanup

```bash
docker compose down
```
