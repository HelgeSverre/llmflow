# Gemini CLI Configuration

Configure Google Gemini CLI to send telemetry to LLMFlow.

## Configuration

Create or edit `~/.gemini/settings.json`:

```json
{
  "telemetry": {
    "enabled": true,
    "endpoint": "http://localhost:1337/v1/logs"
  }
}
```

## Environment Variables

```bash
export GEMINI_TELEMETRY_ENDPOINT="http://localhost:1337/v1/logs"
```

## Usage

```bash
gemini "write a hello world function"
```

Check the LLMFlow dashboard at `http://localhost:1337` for logs.
