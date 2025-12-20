# Langfuse Integration

[Langfuse](https://langfuse.com/) provides LLM observability with prompt management and evaluation features.

## Quick Start

1. Start Langfuse:
   ```bash
   docker compose up -d
   ```

2. Create account at http://localhost:3001:
   - Sign up with email/password
   - Create an organization
   - Create a project
   - Go to Settings → API Keys
   - Copy the Public Key and Secret Key

3. Configure LLMFlow (add to `.env` in project root):
   ```bash
   # Base64 encode your keys: echo -n "pk_xxx:sk_xxx" | base64
   OTLP_EXPORT_ENDPOINT=http://localhost:3001/api/public/otel/v1/traces
   OTLP_EXPORT_HEADERS=Authorization=Basic YOUR_BASE64_ENCODED_KEYS
   ```

4. Restart LLMFlow:
   ```bash
   npm start
   ```

5. Make some LLM requests through the proxy

6. View traces:
   - **Langfuse UI**: http://localhost:3001
   - **LLMFlow Dashboard**: http://localhost:3000

## Langfuse Cloud

For the hosted version:

### EU Region (cloud.langfuse.com)
```bash
OTLP_EXPORT_ENDPOINT=https://cloud.langfuse.com/api/public/otel/v1/traces
OTLP_EXPORT_HEADERS=Authorization=Basic $(echo -n 'pk_xxx:sk_xxx' | base64)
```

### US Region (us.cloud.langfuse.com)
```bash
OTLP_EXPORT_ENDPOINT=https://us.cloud.langfuse.com/api/public/otel/v1/traces
OTLP_EXPORT_HEADERS=Authorization=Basic $(echo -n 'pk_xxx:sk_xxx' | base64)
```

## Features

Langfuse provides:
- LLM trace visualization
- Prompt versioning and management
- A/B testing prompts
- User feedback collection
- Cost tracking
- Evaluation datasets

## Generating Auth Header

```bash
# Linux/macOS
echo -n "pk_your_public_key:sk_your_secret_key" | base64

# Then use in .env:
OTLP_EXPORT_HEADERS=Authorization=Basic cGtfeW91cl9wdWJsaWNfa2V5OnNrX3lvdXJfc2VjcmV0X2tleQ==
```

## Cleanup

```bash
docker compose down -v
```
