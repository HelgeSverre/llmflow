# Claude Code with LLMFlow

Start LLMFlow with Bun installed (`npx llmflow`, or `bun install && bun run build && bun run start` from this checkout). Dashboard and OTLP use port 1337; the proxy uses 8080.

## Send telemetry

Claude Code can export logs and metrics over OTLP/HTTP. LLMFlow accepts JSON or protobuf at `/v1/logs`, `/v1/metrics` and `/v1/traces`.

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:1337
claude
```

View records in the Logs and Metrics tabs at http://localhost:1337. Trace export is optional and version-dependent; see the [current Claude Code monitoring instructions](https://code.claude.com/docs/en/monitoring-usage) for its beta configuration. LLMFlow accepts those spans through the same receiver.

The included launcher applies the log/metric settings while preserving your existing Claude authentication and configuration:

```bash
./run-with-llmflow.sh --print "What is 2+2?"
```

It loads the project-root `.env` if present. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to override the receiver. For console-only telemetry, set `OTEL_LOGS_EXPORTER=console OTEL_METRICS_EXPORTER=console` when invoking the launcher.

## Capture native API requests

Use native passthrough to capture Anthropic request/response bodies, usage and cost:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic
claude
```

This forwards the native Anthropic API format. Use your existing Claude credentials; a valid upstream account is still required. Telemetry export and API proxying are separate options and can be used together.

## Verify setup

Check `http://localhost:1337/api/health`, then run a normal Claude prompt. Telemetry is batched, so allow an export interval before inspecting Logs and Metrics. Server routes are tested locally with fixtures; using the actual Claude CLI requires it to be installed and authenticated.
