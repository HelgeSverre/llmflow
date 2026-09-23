# Codex CLI Configuration

Configure OpenAI Codex CLI to send telemetry to LLMFlow.

## Configuration

Create or edit `~/.codex/config.toml`:

```toml
[otel]
environment = "dev"
log_user_prompt = true  # Include prompts in logs
exporter = { otlp-http = { endpoint = "http://localhost:1337/v1/logs", protocol = "json" } }
```

`protocol` is required for `otlp-http`. This exports logs only; add `trace_exporter` with a `/v1/traces` endpoint for traces.

## Verify

Run any Codex command and check LLMFlow dashboard for incoming logs:

```bash
codex "explain this code"
```
