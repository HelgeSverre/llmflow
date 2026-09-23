# Gemini CLI Configuration

Send Google Gemini CLI telemetry (logs and metrics) to LLMFlow's OTLP receiver.

## Configuration

Either set environment variables for a session:

```bash
export GEMINI_TELEMETRY_ENABLED=true
export GEMINI_TELEMETRY_TARGET=local
export GEMINI_TELEMETRY_OTLP_PROTOCOL=http
export GEMINI_TELEMETRY_OTLP_ENDPOINT=http://127.0.0.1:1337
```

or add the same settings to `~/.gemini/settings.json`:

```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",
    "otlpProtocol": "http",
    "otlpEndpoint": "http://127.0.0.1:1337"
  }
}
```

The endpoint is the LLMFlow base URL: over `http` the CLI appends `/v1/logs` and `/v1/metrics`
itself. Set `GEMINI_TELEMETRY_LOG_PROMPTS=true` (or `"logPrompts": true`) to include prompt text.

## Usage

```bash
gemini -p "write a hello world function"
```

Open the Logs and Metrics tabs at `http://127.0.0.1:1337` and filter by the `gemini-cli` service.
Events such as `gemini_cli.user_prompt` and `gemini_cli.startup_stats` arrive as logs.

Checked with Gemini CLI 0.42 (2026-09-23).
