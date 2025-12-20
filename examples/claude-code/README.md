# Claude Code + OpenTelemetry

This example explores how to monitor Claude Code with OpenTelemetry.

## ⚠️ Important Limitation

**Claude Code exports OTEL metrics and logs, NOT traces.**

LLMFlow currently only supports trace ingestion (`/v1/traces`). Claude Code's telemetry uses:
- `/v1/metrics` - for metrics like token usage, costs, session counts
- `/v1/logs` - for events like user prompts, tool calls, API requests

This means **Claude Code's OTEL export doesn't work directly with LLMFlow's current implementation**.

## What Claude Code Exports

When you enable `CLAUDE_CODE_ENABLE_TELEMETRY=1`, Claude Code exports:

### Metrics
- `claude_code.session.count` - CLI sessions started
- `claude_code.token.usage` - Token usage (input/output/cache)
- `claude_code.cost.usage` - Cost by model
- `claude_code.lines_of_code.count` - Lines modified
- `claude_code.pull_request.count` - PRs created
- `claude_code.commit.count` - Commits created
- `claude_code.code_edit_tool.decision` - Tool permission decisions

### Events (Logs)
- `claude_code.user_prompt` - User prompt submissions
- `claude_code.tool_result` - Tool execution results
- `claude_code.api_request` - API requests with duration and tokens
- `claude_code.api_error` - API errors

## Options for Monitoring Claude Code

### Option 1: Use Console Exporter (This Example)

See what Claude Code exports without needing a full OTEL stack:

```bash
./run-with-llmflow.sh --print "What is 2+2?"
```

This uses `OTEL_METRICS_EXPORTER=console` to print telemetry to stdout.

### Option 2: Use a Full OTEL Stack

Set up Grafana Cloud, SigNoz, or similar:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway.your-provider.com:4317"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your-token"
claude
```

See the [official docs](https://docs.anthropic.com/en/docs/claude-code/monitoring-usage) for details.

### Option 3: Extend LLMFlow

LLMFlow could be extended to support:
- `/v1/metrics` endpoint for OTLP metrics
- `/v1/logs` endpoint for OTLP logs

This would require implementing the OTLP metrics and logs protocols.

### Option 4: Use a Proxy (Not Supported)

Claude Code uses the native Anthropic API format, not OpenAI-compatible format. The LLMFlow proxy expects OpenAI-style requests. You would need:
- A proxy that translates Anthropic format to/from OpenAI format
- Or modify LLMFlow's Anthropic provider to pass through native requests

Projects like [claude-code-proxy](https://github.com/fuergaosi233/claude-code-proxy) do the reverse (OpenAI → Anthropic) which doesn't help here.

## Running This Example

```bash
# Make script executable
chmod +x run-with-llmflow.sh

# Run with console telemetry (see what Claude exports)
./run-with-llmflow.sh --print "Explain observability in one sentence"

# Interactive mode
./run-with-llmflow.sh
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Enable telemetry (`1`) |
| `OTEL_METRICS_EXPORTER` | `console`, `otlp`, `prometheus` |
| `OTEL_LOGS_EXPORTER` | `console`, `otlp` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc`, `http/json`, `http/protobuf` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers |
| `OTEL_METRIC_EXPORT_INTERVAL` | Export interval in ms (default: 60000) |
| `OTEL_LOGS_EXPORT_INTERVAL` | Logs export interval in ms (default: 5000) |
| `OTEL_LOG_USER_PROMPTS` | Include prompt content in logs (`1`) |

## Isolated Configuration

The script uses `CLAUDE_CONFIG_DIR` to avoid affecting your normal Claude Code setup:
- Config stored in `./.claude-config/`
- May need to authenticate: set `ANTHROPIC_API_KEY` in project root `.env`

## References

- [Claude Code Monitoring Docs](https://docs.anthropic.com/en/docs/claude-code/monitoring-usage)
- [Claude Code OTEL Stack](https://github.com/ColeMurray/claude-code-otel) - Full Grafana/Prometheus setup
- [SigNoz Guide](https://signoz.io/blog/claude-code-monitoring-with-opentelemetry/) - Using SigNoz with Claude Code
