# RFC: AI CLI Tools Observability Support

**Status**: Draft  
**Created**: 2025-12-20  
**Author**: LLMFlow Team

## Summary

This RFC proposes comprehensive observability support for AI CLI coding tools including Claude Code, Codex CLI, Gemini CLI, OpenCode, Aider, and Cline. The goal is to make LLMFlow a universal observability backend for AI-assisted development workflows.

## Background

AI CLI tools have become essential for modern software development. Each tool has different telemetry mechanisms:

| Tool | Telemetry Type | Protocol | Current Status |
|------|---------------|----------|----------------|
| Claude Code | Metrics + Logs | OTLP (gRPC/HTTP) | Not supported by LLMFlow |
| Codex CLI | Log Events | OTLP (HTTP/gRPC) | Not supported by LLMFlow |
| Gemini CLI | Metrics + Logs + Traces | OTLP (HTTP/gRPC) | Partially supported (traces only) |
| OpenCode | File-based logs | Local files | Not applicable |
| Aider | PostHog analytics | HTTP | Not applicable |
| Cline | PostHog analytics | VS Code telemetry | Not applicable |

LLMFlow currently only supports trace ingestion (`/v1/traces`), which means most AI CLI tools' native telemetry cannot be collected.

## Tool-by-Tool Analysis

### 1. Claude Code

**Telemetry Mechanism**: OpenTelemetry metrics and logs (NOT traces)

**Environment Variables**:
```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp|console
OTEL_LOGS_EXPORTER=otlp|console
OTEL_EXPORTER_OTLP_PROTOCOL=grpc|http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

**Exported Metrics**:
- `claude_code.session.count` - CLI sessions started
- `claude_code.token.usage` - Token usage (input/output/cache)
- `claude_code.cost.usage` - Cost by model
- `claude_code.lines_of_code.count` - Lines modified
- `claude_code.pull_request.count` - PRs created
- `claude_code.commit.count` - Commits created
- `claude_code.code_edit_tool.decision` - Tool permission decisions

**Exported Log Events**:
- `claude_code.user_prompt` - User prompt submissions
- `claude_code.tool_result` - Tool execution results
- `claude_code.api_request` - API requests with duration and tokens
- `claude_code.api_error` - API errors

**API Format**: Native Anthropic API (not OpenAI-compatible)

**LLMFlow Integration Requirements**:
1. Implement `/v1/logs` OTLP endpoint
2. Implement `/v1/metrics` OTLP endpoint
3. Implement passthrough proxy mode for native Anthropic API

### 2. OpenAI Codex CLI

**Telemetry Mechanism**: OpenTelemetry log events (NOT traces)

**Configuration** (in `~/.codex/config.toml`):
```toml
[otel]
environment = "staging"   # defaults to "dev"
exporter = "otlp-http"    # or "otlp-grpc" or "none"
log_user_prompt = false   # redact prompts unless true

[otel.exporter."otlp-http"]
endpoint = "https://otel.example.com/v1/logs"
protocol = "binary"  # or "json"

[otel.exporter."otlp-http".headers]
"x-otlp-api-key" = "${OTLP_TOKEN}"
```

**Exported Log Events**:
- `codex.run_started` - Session start
- `codex.user_input` - User prompts (redacted by default)
- `codex.model_response` - Model responses
- `codex.tool_decision` - Tool approval decisions
- `codex.tool_result` - Tool execution results

**API Format**: Native OpenAI API (chat completions or responses)

**LLMFlow Integration Requirements**:
1. Implement `/v1/logs` OTLP endpoint
2. Default OpenAI proxy already works for API calls

### 3. Google Gemini CLI

**Telemetry Mechanism**: Full OpenTelemetry (metrics, logs, traces)

**Configuration** (in `.gemini/settings.json`):
```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",  // or "gcp"
    "otlpEndpoint": "http://localhost:4317",
    "otlpProtocol": "grpc",  // or "http"
    "logPrompts": true,
    "outfile": ".gemini/telemetry.log"
  }
}
```

**Environment Variables**:
```bash
GEMINI_TELEMETRY_ENABLED=true
GEMINI_TELEMETRY_TARGET=local|gcp
GEMINI_TELEMETRY_OTLP_ENDPOINT=http://localhost:4317
GEMINI_TELEMETRY_OTLP_PROTOCOL=grpc|http
GEMINI_TELEMETRY_LOG_PROMPTS=true
```

**Exported Metrics**:
- `gemini_cli.session.count` - Sessions started
- `gemini_cli.tool.call.count` - Tool call counts
- `gemini_cli.tool.call.latency` - Tool call latency
- `gemini_cli.api.request.count` - API request counts
- `gemini_cli.api.request.latency` - API latency
- `gemini_cli.token.usage` - Token usage
- `gen_ai.client.token.usage` - GenAI semantic convention compliant

**Exported Log Events**:
- `gemini_cli.config` - Configuration at startup
- `gemini_cli.user_prompt` - User prompts
- `gemini_cli.tool_call` - Tool invocations
- `gemini_cli.tool_output` - Tool results
- `gemini_cli.api_request` - API requests
- `gemini_cli.api_response` - API responses
- `gemini_cli.api_error` - API errors

**API Format**: Native Google Gemini API

**LLMFlow Integration Requirements**:
1. Implement `/v1/logs` OTLP endpoint
2. Implement `/v1/metrics` OTLP endpoint
3. Traces already work with existing `/v1/traces`
4. Add Gemini provider for passthrough proxy

### 4. OpenCode (sst/opencode)

**Telemetry Mechanism**: Local file-based logging (OTEL integration in progress via PR #5245)

**Current State**:
- Logs written to `~/.local/share/opencode/log/`
- Debug mode via `--log-level DEBUG`
- Session data stored in `~/.local/share/opencode/project/`

**Future OTEL Support** (per PR #5245):
- Span wrapping for CLI operations
- Error event logging
- Likely metrics support

**API Format**: Uses various providers (OpenAI, Anthropic, Google, etc.)

**LLMFlow Integration Requirements**:
1. Currently best integrated via proxy (supports multiple providers)
2. Monitor OTEL PR for future native integration

### 5. Aider

**Telemetry Mechanism**: PostHog analytics (opt-in)

**Configuration**:
```bash
aider --analytics              # Enable for session
aider --no-analytics           # Disable for session
aider --analytics-disable      # Permanently disable
aider --analytics-log file.jsonl  # Log to file
```

**Collected Data**:
- Model usage and token counts
- Edit format usage
- Feature and command usage
- Exception/error information

**Proxy Support**: 
- Uses LiteLLM internally
- Supports `--openai-api-base` for proxy configuration

**LLMFlow Integration Requirements**:
1. Use LLMFlow as proxy via `--openai-api-base http://localhost:8080/v1`
2. Analytics cannot be directly integrated (PostHog-based)

### 6. Cline

**Telemetry Mechanism**: PostHog analytics (opt-in, respects VS Code settings)

**Collected Data**:
- Task interactions (start/finish, no content)
- Mode and tool usage
- Token usage metrics
- System context (OS, VS Code environment)
- UI activity patterns

**MCP Integration**: 
- Supports MCP servers for tool access
- Can connect to external data sources

**LLMFlow Integration Requirements**:
1. Use LLMFlow as API proxy via Cline's provider configuration
2. Potentially create MCP server for LLMFlow data access
3. Analytics cannot be directly integrated (PostHog-based)

## Proposed Features

### Priority 1: OTLP Logs Endpoint (`/v1/logs`)

**Unlocks**: Claude Code, Codex CLI, Gemini CLI

See [RFC: OTLP Metrics and Logs Support](./metrics-and-logs.md) for implementation details.

### Priority 2: OTLP Metrics Endpoint (`/v1/metrics`)

**Unlocks**: Claude Code, Gemini CLI

See [RFC: OTLP Metrics and Logs Support](./metrics-and-logs.md) for implementation details.

### Priority 3: Passthrough Proxy Mode

**Unlocks**: Claude Code native API, Gemini CLI native API

See [RFC: Passthrough Proxy Mode](./passthrough-mode.md) for implementation details.

### Priority 4: Provider Extensions

Add native provider support for:
- Google Gemini API
- Enhanced Anthropic passthrough

## Configuration Examples

### Claude Code with LLMFlow

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

### Codex CLI with LLMFlow

```toml
# ~/.codex/config.toml
[otel]
exporter = "otlp-http"
log_user_prompt = true

[otel.exporter."otlp-http"]
endpoint = "http://localhost:3000/v1/logs"
protocol = "json"
```

### Gemini CLI with LLMFlow

```json
// .gemini/settings.json
{
  "telemetry": {
    "enabled": true,
    "target": "local",
    "otlpEndpoint": "http://localhost:3000",
    "otlpProtocol": "http"
  }
}
```

### Aider with LLMFlow Proxy

```bash
# Use LLMFlow as proxy
aider --openai-api-base http://localhost:8080/v1 \
      --model gpt-4o-mini \
      --analytics-log ~/.llmflow/aider-analytics.jsonl
```

## Dashboard Enhancements

To fully support AI CLI tools, the dashboard should:

1. **Tool-specific views**: Filter by tool (Claude Code, Codex, Gemini, etc.)
2. **Session tracking**: Group related spans/logs by session ID
3. **Token analytics**: Visualize token usage across tools
4. **Cost tracking**: Aggregate costs by tool and model
5. **Tool call analysis**: Track which tools are used most frequently

## Implementation Phases

### Phase 1: OTLP Logs (2-3 weeks)
- Implement `/v1/logs` endpoint
- Add log storage to database schema
- Create log viewer in dashboard
- Test with Codex CLI

### Phase 2: OTLP Metrics (2-3 weeks)
- Implement `/v1/metrics` endpoint
- Add metrics aggregation
- Create metrics dashboard
- Test with Claude Code and Gemini CLI

### Phase 3: Passthrough Mode (1-2 weeks)
- Implement passthrough proxy mode
- Add native Anthropic API support
- Test with Claude Code

### Phase 4: Dashboard Enhancements (2-3 weeks)
- Tool-specific filtering
- Session grouping
- Enhanced analytics views

## Success Metrics

1. **Coverage**: Support 4+ major AI CLI tools
2. **Adoption**: Users can configure tools in < 5 minutes
3. **Data richness**: Capture tokens, costs, tool usage, errors
4. **Performance**: < 10ms overhead per request

## References

- [Claude Code Monitoring Docs](https://docs.anthropic.com/en/docs/claude-code/monitoring-usage)
- [Codex CLI Config](https://github.com/openai/codex/blob/main/docs/config.md)
- [Gemini CLI Telemetry](https://google-gemini.github.io/gemini-cli/docs/cli/telemetry.html)
- [OpenCode Telemetry PR](https://github.com/sst/opencode/pull/5245)
- [Aider Analytics](https://aider.chat/docs/more/analytics.html)
- [Cline Telemetry](https://docs.cline.bot/more-info/telemetry)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
