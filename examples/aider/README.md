# Aider Configuration

Configure Aider to route requests through LLMFlow proxy.

## Proxy Mode

Point Aider to LLMFlow's OpenAI-compatible proxy:

```bash
aider --openai-api-base http://localhost:3000/proxy/openai/v1
```

## Environment Variables

```bash
export OPENAI_API_BASE="http://localhost:3000/proxy/openai/v1"
export OPENAI_API_KEY="your-api-key"

aider
```

## With Specific Model

```bash
aider --openai-api-base http://localhost:3000/proxy/openai/v1 \
      --model gpt-4o
```

## Configuration File

Add to `~/.aider.conf.yml`:

```yaml
openai-api-base: http://localhost:3000/proxy/openai/v1
```

All requests will be logged and visible in the LLMFlow dashboard.
