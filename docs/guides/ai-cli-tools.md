# AI CLI Tools Integration Guide

LLMFlow provides observability for AI coding assistants including Claude Code, Codex CLI, Gemini CLI, and Aider. This guide covers how to integrate each tool with LLMFlow.

## Overview

AI CLI tools can be integrated with LLMFlow in two ways:

1. **Passthrough Proxy** - Forward native API requests through LLMFlow for logging
2. **OTLP Telemetry** - Send OpenTelemetry logs/metrics directly to LLMFlow

| Tool        | Passthrough | OTLP Logs | OTLP Metrics |
| ----------- | ----------- | --------- | ------------ |
| Claude Code | ✅          | ✅        | ✅           |
| Codex CLI   | ✅          | ✅        | -            |
| Gemini CLI  | ✅          | ✅        | ✅           |
| Aider       | ✅          | -         | -            |
| Cline       | ✅          | -         | -            |

---

## Claude Code

Claude Code is Anthropic's AI coding assistant. It uses the native Anthropic API format.

### Option 1: Passthrough Proxy (Recommended)

```bash
# Set Claude Code to use LLMFlow passthrough
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic

# Run Claude Code
claude
```

All requests will be proxied through LLMFlow with:

- Full request/response logging
- Token usage tracking
- Cost calculation
- Visible in the Timeline view

### Option 2: OTLP Telemetry

Claude Code can export OpenTelemetry metrics and logs:

```bash
# Enable Claude Code telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000

# Run Claude Code
claude
```

#### Exported Metrics

- `claude_code.session.count` - CLI sessions started
- `claude_code.token.usage` - Token usage by type (input/output/cache)
- `claude_code.cost.usage` - Cost by model
- `claude_code.lines_of_code.count` - Lines modified
- `claude_code.tool.decision` - Tool permission decisions

#### Exported Logs

- `claude_code.user_prompt` - User prompt submissions
- `claude_code.tool_result` - Tool execution results
- `claude_code.api_request` - API requests with duration/tokens
- `claude_code.api_error` - API errors

---

## Codex CLI

OpenAI's Codex CLI uses OpenTelemetry for telemetry.

### Option 1: Passthrough Proxy

```bash
# Set Codex CLI to use LLMFlow passthrough
export OPENAI_BASE_URL=http://localhost:8080/passthrough/openai

# Run Codex CLI
codex
```

### Option 2: OTLP Logs

Configure in `~/.codex/config.toml`:

```toml
[otel]
environment = "dev"
exporter = "otlp-http"
log_user_prompt = true  # Include prompts in logs

[otel.exporter."otlp-http"]
endpoint = "http://localhost:3000/v1/logs"
protocol = "json"
```

#### Exported Log Events

- `codex.run_started` - Session start
- `codex.user_input` - User prompts (redacted by default)
- `codex.model_response` - Model responses
- `codex.tool_decision` - Tool approval decisions
- `codex.tool_result` - Tool execution results

---

## Gemini CLI

Google's Gemini CLI supports full OpenTelemetry.

### Option 1: Passthrough Proxy

```bash
# Set Gemini CLI to use LLMFlow passthrough
export GEMINI_API_BASE=http://localhost:8080/passthrough/gemini

# Run Gemini CLI
gemini
```

### Option 2: OTLP Telemetry

Configure in `.gemini/settings.json`:

```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",
    "otlpEndpoint": "http://localhost:3000",
    "otlpProtocol": "http",
    "logPrompts": true
  }
}
```

Or via environment variables:

```bash
export GEMINI_TELEMETRY_ENABLED=true
export GEMINI_TELEMETRY_TARGET=local
export GEMINI_TELEMETRY_OTLP_ENDPOINT=http://localhost:3000
export GEMINI_TELEMETRY_OTLP_PROTOCOL=http
```

#### Exported Telemetry

**Metrics:**

- `gemini_cli.session.count`
- `gemini_cli.tool.call.count`
- `gemini_cli.api.request.count`
- `gemini_cli.token.usage`

**Logs:**

- `gemini_cli.user_prompt`
- `gemini_cli.tool_call`
- `gemini_cli.api_request`
- `gemini_cli.api_error`

---

## Aider

Aider uses the OpenAI SDK and can be proxied through LLMFlow.

```bash
# Use LLMFlow as proxy
aider --openai-api-base http://localhost:8080/v1 \
      --model gpt-4o-mini

# For Anthropic models
aider --anthropic-api-base http://localhost:8080/anthropic \
      --model claude-3-haiku-20240307
```

---

## Cline

Cline (VS Code extension) can be configured to use LLMFlow as a proxy.

1. Open Cline settings in VS Code
2. Set the API base URL to `http://localhost:8080/passthrough/anthropic` (for Anthropic)
3. All Cline requests will be logged in LLMFlow

---

## Dashboard: Timeline View

The LLMFlow dashboard includes a unified **Timeline** view that shows activity from all AI CLI tools in one place.

### Features

- **Unified feed** - Traces, logs, and metrics from all tools
- **Tool filtering** - Filter by Claude Code, Codex CLI, Gemini CLI, etc.
- **Type filtering** - Show only traces, logs, or metrics
- **Correlation** - Click a trace to see related logs
- **Tool colors** - Each tool has a distinct color for easy identification

### Tool Colors

| Tool          | Color     |
| ------------- | --------- |
| Claude Code   | 🟣 Purple |
| Codex CLI     | 🟢 Green  |
| Gemini CLI    | 🔵 Blue   |
| Aider         | 🟠 Orange |
| Proxy (other) | ⚪ Gray   |

---

## Troubleshooting

### Passthrough not working

1. Check the passthrough path is correct:
   - Claude Code: `/passthrough/anthropic/*`
   - Gemini CLI: `/passthrough/gemini/*`
   - OpenAI tools: `/passthrough/openai/*`

2. Verify API key is being passed:
   - Either in `Authorization: Bearer <key>` header
   - Or provider-specific header (`x-api-key` for Anthropic)

3. Check LLMFlow logs for errors:
   ```bash
   VERBOSE=1 npm start
   ```

### OTLP telemetry not appearing

1. Verify endpoint is correct:
   - Logs: `http://localhost:3000/v1/logs`
   - Metrics: `http://localhost:3000/v1/metrics`

2. Check protocol is set to HTTP/JSON (not gRPC):

   ```bash
   export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
   ```

3. Ensure telemetry is enabled in the tool's config

### Tool not detected correctly

LLMFlow auto-detects tools based on:

- Provider name (e.g., `anthropic-passthrough`)
- Service name in OTLP telemetry
- Event name patterns

If a tool is showing as "Proxy", check that the service name is set correctly in the tool's OTLP configuration.

---

## Next Steps

- [Provider Configuration](../rfcs/ai-cli-tools-support.md) - Full RFC with implementation details
- [Passthrough Mode RFC](../rfcs/passthrough-mode.md) - Technical design of passthrough
- [OTLP Metrics and Logs](../rfcs/metrics-and-logs.md) - OTLP ingestion implementation
