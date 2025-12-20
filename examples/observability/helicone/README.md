# Helicone Integration

[Helicone](https://helicone.ai/) provides LLM cost tracking, caching, and analytics.

## Integration Method

Helicone works as a **proxy gateway**, not OTLP export. LLMFlow routes requests through Helicone to OpenAI.

```
Your App → LLMFlow Proxy → Helicone Gateway → OpenAI
```

## Quick Start with Helicone Cloud

1. Create account at https://helicone.ai and get API key

2. Configure LLMFlow to use Helicone passthrough:

   **Option A: Via environment variables**
   ```bash
   # Add to .env
   HELICONE_API_KEY=sk-helicone-xxx
   ```

   Then use the passthrough route:
   ```javascript
   const client = new OpenAI({
       baseURL: 'http://localhost:8080/passthrough/helicone/v1'
   });
   ```

   **Option B: Via headers**
   ```javascript
   const client = new OpenAI({
       baseURL: 'http://localhost:8080/passthrough/helicone/v1',
       defaultHeaders: {
           'Helicone-Auth': 'Bearer sk-helicone-xxx'
       }
   });
   ```

3. Make LLM requests - they'll be logged in both LLMFlow and Helicone

4. View analytics:
   - **Helicone Dashboard**: https://helicone.ai/dashboard
   - **LLMFlow Dashboard**: http://localhost:3000

## Self-Hosted Helicone

1. Start Helicone locally (see [Helicone docs](https://docs.helicone.ai/getting-started/self-host/docker))

2. Configure LLMFlow:
   ```bash
   # .env
   HELICONE_HOST=localhost
   HELICONE_PORT=8585
   HELICONE_API_KEY=sk-helicone-xxx
   ```

## Helicone Features

When using the Helicone passthrough, you can use Helicone's features via headers:

```javascript
const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }]
}, {
    headers: {
        // Custom properties for filtering
        'Helicone-Property-Environment': 'production',
        'Helicone-Property-Feature': 'chatbot',
        
        // User tracking
        'Helicone-User-Id': 'user-123',
        
        // Session grouping
        'Helicone-Session-Id': 'session-abc',
        'Helicone-Session-Name': 'Customer Support',
        
        // Caching
        'Helicone-Cache-Enabled': 'true',
        
        // Retries
        'Helicone-Retry-Enabled': 'true'
    }
});
```

## Benefits of Dual Logging

Using LLMFlow + Helicone together:

| LLMFlow | Helicone |
|---------|----------|
| Local SQLite storage | Cloud storage |
| Real-time WebSocket | Cost analytics |
| Multi-provider support | Caching & rate limits |
| OTLP export | Team collaboration |
| Timeline view | Request playground |

## Example Code

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:8080/passthrough/helicone/v1',
    defaultHeaders: {
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
        'Helicone-Property-App': 'my-app'
    }
});

const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
// Logged in both LLMFlow (localhost:3000) and Helicone (helicone.ai)
```
