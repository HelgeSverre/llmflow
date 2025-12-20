# Codex CLI Configuration

Configure OpenAI Codex CLI to send telemetry to LLMFlow.

## Configuration

Create or edit `~/.codex/config.toml`:

```toml
# Enable OTLP telemetry
[telemetry]
enabled = true

[telemetry.otlp]
endpoint = "http://localhost:3000/v1/logs"
protocol = "http"
```

## Environment Variables

Alternatively, use environment variables:

```bash
export CODEX_OTLP_ENDPOINT="http://localhost:3000/v1/logs"
export CODEX_TELEMETRY_ENABLED=true
```

## Verify

Run any Codex command and check LLMFlow dashboard for incoming logs:

```bash
codex "explain this code"
```
