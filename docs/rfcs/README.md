# LLMFlow RFCs

This directory contains Request for Comments (RFC) documents that propose new features and architectural changes for LLMFlow.

## Active RFCs

### [AI CLI Tools Support](./ai-cli-tools-support.md)

**Status**: Draft

Comprehensive support for AI CLI coding tools including Claude Code, Codex CLI, Gemini CLI, OpenCode, Aider, and Cline. This is the overarching RFC that ties together the other proposals.

**Key findings**:

- Claude Code and Codex CLI export OTEL logs (not traces)
- Gemini CLI exports full OTEL (traces, metrics, logs)
- Tools like Aider and Cline use PostHog analytics
- Most tools can be proxied for API-level observability

### [OTLP Metrics and Logs Support](./metrics-and-logs.md)

**Status**: Draft

Add `/v1/metrics` and `/v1/logs` OTLP endpoints to complement the existing `/v1/traces` endpoint. This enables LLMFlow to receive telemetry from AI CLI tools that export metrics and logs rather than traces.

**Key features**:

- `/v1/logs` endpoint for OTLP log records
- `/v1/metrics` endpoint for OTLP metrics
- Database schema for logs and metrics
- Dashboard APIs for viewing collected data
- Correlation of logs with traces via `trace_id`

### [Passthrough Proxy Mode](./passthrough-mode.md)

**Status**: Draft

Forward requests to upstream providers without body transformation. Enables observability for AI CLI tools like Claude Code that use native API formats rather than OpenAI-compatible formats.

**Key features**:

- `/passthrough/:provider/*` routes
- Native Anthropic API support (for Claude Code)
- Native Gemini API support
- Streaming support
- Usage extraction from native response formats

## Implementation Priority

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI CLI Tools Support                          │
│                    (overarching goal)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  OTLP Logs      │ │  OTLP Metrics   │ │  Passthrough    │
│  /v1/logs       │ │  /v1/metrics    │ │  Proxy Mode     │
│                 │ │                 │ │                 │
│ Unlocks:        │ │ Unlocks:        │ │ Unlocks:        │
│ - Codex CLI     │ │ - Claude Code   │ │ - Claude Code   │
│ - Claude Code   │ │ - Gemini CLI    │ │   (native API)  │
│ - Gemini CLI    │ │                 │ │ - Gemini CLI    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
     Phase 1             Phase 2            Phase 3
    (2-3 weeks)         (2-3 weeks)       (1-2 weeks)
```

## Tool Compatibility Matrix

After implementation, the following tools will be supported:

| Tool        | Proxy            | OTEL Traces | OTEL Logs | OTEL Metrics | Native API |
| ----------- | ---------------- | ----------- | --------- | ------------ | ---------- |
| Claude Code | ✅ (passthrough) | ❌          | ✅        | ✅           | ✅         |
| Codex CLI   | ✅               | ❌          | ✅        | ❌           | ✅         |
| Gemini CLI  | ✅ (passthrough) | ✅          | ✅        | ✅           | ✅         |
| OpenCode    | ✅               | 🔜          | 🔜        | 🔜           | ✅         |
| Aider       | ✅               | ❌          | ❌        | ❌           | ✅         |
| Cline       | ✅               | ❌          | ❌        | ❌           | ✅         |

Legend: ✅ Supported | ❌ Not applicable | 🔜 Coming (pending upstream)

## Quick Start Examples

Once all features are implemented:

### Claude Code

```bash
# Enable telemetry to LLMFlow
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000

# OR use passthrough proxy for API calls
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic

claude
```

### Codex CLI

```toml
# ~/.codex/config.toml
[otel]
exporter = "otlp-http"

[otel.exporter."otlp-http"]
endpoint = "http://localhost:3000/v1/logs"
protocol = "json"
```

### Gemini CLI

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

### Aider

```bash
aider --openai-api-base http://localhost:8080/v1
```

## Contributing

To propose a new feature:

1. Copy the template below
2. Fill in the sections
3. Submit a PR to add the RFC

### RFC Template

```markdown
# RFC: [Feature Name]

**Status**: Draft | In Progress | Accepted | Implemented | Rejected
**Created**: YYYY-MM-DD
**Author**: [Name]

## Summary

One paragraph description.

## Motivation

Why is this needed?

## Design

Technical details and implementation approach.

## Migration Path

How will this be rolled out?

## References

Links to relevant documentation.
```

## Changelog

- **2025-12-20**: Initial RFCs created for AI CLI tools support
