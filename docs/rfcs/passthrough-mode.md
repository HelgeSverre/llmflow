# RFC: Passthrough Proxy Mode

**Status**: Draft  
**Created**: 2025-12-20  
**Author**: LLMFlow Team

## Summary

This RFC proposes a "passthrough" proxy mode for LLMFlow that forwards requests to upstream providers without body transformation. This enables observability for AI CLI tools like Claude Code that use native API formats (e.g., Anthropic's `/v1/messages`) rather than OpenAI-compatible formats.

## Motivation

### Current Architecture

LLMFlow's proxy currently transforms requests between formats:

```
Client (OpenAI format) → LLMFlow Proxy → Transform → Provider (Native format)
                                       ← Transform ←
```

This works well for:

- Applications using OpenAI SDK with other providers
- Custom applications that standardize on OpenAI format

### The Problem

AI CLI tools like Claude Code send requests in native Anthropic format:

```javascript
// Claude Code sends this (Anthropic native format):
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 4096,
  "system": "You are a coding assistant",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}

// But LLMFlow's Anthropic provider expects OpenAI format:
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    { "role": "system", "content": "You are a coding assistant" },
    { "role": "user", "content": "Hello" }
  ]
}
```

When Claude Code points to LLMFlow as proxy, the transformation logic corrupts the request because it tries to transform an already-native request.

### The Solution

Add a **passthrough mode** that:

1. Forwards requests without body transformation
2. Logs the request/response for observability
3. Extracts usage metrics from native response formats

## Design

### Passthrough Detection

Three ways to enable passthrough mode:

#### 1. Explicit Header

```bash
curl -X POST http://localhost:8080/anthropic/v1/messages \
  -H "X-LLMFlow-Passthrough: true" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-20250514", ...}'
```

#### 2. Path-Based

Use `/passthrough/` prefix:

```
/passthrough/anthropic/v1/messages → Forward to api.anthropic.com/v1/messages
/passthrough/google/v1beta/models/... → Forward to generativelanguage.googleapis.com/...
```

#### 3. Provider Configuration

Configure specific providers for passthrough:

```javascript
// In provider configuration
{
  "anthropic": {
    "passthrough": true,
    "hostname": "api.anthropic.com"
  }
}
```

### Passthrough Flow

```
┌─────────────┐     ┌───────────────────┐     ┌──────────────┐
│ Claude Code │────►│   LLMFlow Proxy   │────►│  Anthropic   │
│ (Native API)│     │                   │     │     API      │
└─────────────┘     │ 1. Log request    │     └──────────────┘
                    │ 2. Forward as-is  │            │
                    │ 3. Log response   │◄───────────┘
                    │ 4. Extract usage  │
                    └───────────────────┘
```

### Implementation

#### Base Passthrough Handler

```javascript
// providers/passthrough.js

class PassthroughHandler {
  constructor(targetHost, options = {}) {
    this.targetHost = targetHost;
    this.extractUsage = options.extractUsage || defaultExtractUsage;
    this.identifyModel = options.identifyModel || defaultIdentifyModel;
    this.headerTransform = options.headerTransform || defaultHeaderTransform;
  }

  async handle(req, res) {
    const startTime = Date.now();
    const traceId = req.headers["x-trace-id"] || uuidv4();

    try {
      // Transform only headers, not body
      const headers = this.headerTransform(req.headers);

      // Forward request as-is
      const response = await this.forward(req, headers);

      // Log for observability
      const duration = Date.now() - startTime;
      const usage = this.extractUsage(response.body);
      const model = this.identifyModel(req.body, response.body);

      this.logInteraction(traceId, req, response, duration, usage, model);

      // Return original response
      res.status(response.status);
      Object.entries(response.headers).forEach(([k, v]) => res.setHeader(k, v));
      res.send(response.body);
    } catch (error) {
      this.logError(traceId, req, error, Date.now() - startTime);
      res.status(502).json({
        error: "Passthrough failed",
        message: error.message,
      });
    }
  }

  async forward(req, headers) {
    const url = `https://${this.targetHost}${req.path}`;

    const response = await fetch(url, {
      method: req.method,
      headers: headers,
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });

    const body = await response.json();

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body,
    };
  }

  logInteraction(traceId, req, response, duration, usage, model) {
    db.insertTrace({
      id: traceId,
      timestamp: Date.now(),
      duration_ms: duration,
      provider: this.provider,
      model: model,
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
      estimated_cost: calculateCost(
        model,
        usage?.prompt_tokens,
        usage?.completion_tokens,
      ),
      status: response.status,
      request_method: req.method,
      request_path: req.path,
      request_headers: req.headers,
      request_body: req.body,
      response_status: response.status,
      response_body: response.body,
      span_type: "llm",
      span_name: "passthrough",
    });
  }
}
```

#### Anthropic Passthrough

```javascript
// providers/anthropic-passthrough.js

class AnthropicPassthrough extends PassthroughHandler {
  constructor() {
    super("api.anthropic.com", {
      extractUsage: (body) => ({
        prompt_tokens: body.usage?.input_tokens || 0,
        completion_tokens: body.usage?.output_tokens || 0,
        total_tokens:
          (body.usage?.input_tokens || 0) + (body.usage?.output_tokens || 0),
      }),
      identifyModel: (reqBody) => reqBody?.model,
      headerTransform: (headers) => {
        // Pass through API key
        const apiKey =
          headers["x-api-key"] || headers.authorization?.replace("Bearer ", "");
        return {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": headers["anthropic-version"] || "2023-06-01",
        };
      },
    });
    this.provider = "anthropic";
  }
}
```

#### Gemini Passthrough

```javascript
// providers/gemini-passthrough.js

class GeminiPassthrough extends PassthroughHandler {
  constructor() {
    super("generativelanguage.googleapis.com", {
      extractUsage: (body) => ({
        prompt_tokens: body.usageMetadata?.promptTokenCount || 0,
        completion_tokens: body.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: body.usageMetadata?.totalTokenCount || 0,
      }),
      identifyModel: (reqBody, respBody) => {
        // Model is often in the path or response
        return respBody?.modelVersion || "gemini-unknown";
      },
      headerTransform: (headers) => ({
        "Content-Type": "application/json",
        "x-goog-api-key":
          headers["x-goog-api-key"] ||
          headers.authorization?.replace("Bearer ", ""),
      }),
    });
    this.provider = "gemini";
  }
}
```

### Streaming Support

Passthrough mode must handle streaming responses:

```javascript
async handleStreaming(req, res) {
    const startTime = Date.now();
    const traceId = req.headers['x-trace-id'] || uuidv4();

    const headers = this.headerTransform(req.headers);
    const url = `https://${this.targetHost}${req.path}`;

    const response = await fetch(url, {
        method: req.method,
        headers: headers,
        body: JSON.stringify(req.body)
    });

    // Forward status and headers
    res.status(response.status);
    Object.entries(Object.fromEntries(response.headers)).forEach(([k, v]) => {
        res.setHeader(k, v);
    });

    // Stream while buffering for logging
    let fullContent = '';
    let finalUsage = null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);

        // Parse for usage (provider-specific)
        const parsed = this.parseStreamChunk(chunk);
        if (parsed.content) fullContent += parsed.content;
        if (parsed.usage) finalUsage = parsed.usage;
    }

    res.end();

    // Log after stream completes
    const duration = Date.now() - startTime;
    this.logStreamingInteraction(traceId, req, fullContent, finalUsage, duration);
}

parseStreamChunk(chunk) {
    // Anthropic SSE format
    const lines = chunk.split('\n');
    let content = '';
    let usage = null;

    for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
            const json = JSON.parse(payload);
            if (json.type === 'content_block_delta') {
                content += json.delta?.text || '';
            }
            if (json.type === 'message_delta' && json.usage) {
                usage = {
                    prompt_tokens: 0,
                    completion_tokens: json.usage.output_tokens || 0,
                    total_tokens: json.usage.output_tokens || 0
                };
            }
        } catch {}
    }

    return { content, usage };
}
```

### Router Integration

```javascript
// server.js

const { AnthropicPassthrough } = require("./providers/anthropic-passthrough");
const { GeminiPassthrough } = require("./providers/gemini-passthrough");

const passthroughHandlers = {
  anthropic: new AnthropicPassthrough(),
  gemini: new GeminiPassthrough(),
};

// Passthrough routes
proxyApp.all("/passthrough/:provider/*", async (req, res) => {
  const provider = req.params.provider.toLowerCase();
  const handler = passthroughHandlers[provider];

  if (!handler) {
    return res.status(400).json({
      error: "Unknown provider",
      available: Object.keys(passthroughHandlers),
    });
  }

  // Remove /passthrough/:provider from path
  req.path = req.path.replace(`/passthrough/${provider}`, "");

  if (req.body?.stream) {
    await handler.handleStreaming(req, res);
  } else {
    await handler.handle(req, res);
  }
});

// Header-based passthrough detection
proxyApp.use((req, res, next) => {
  if (req.headers["x-llmflow-passthrough"] === "true") {
    const { provider } = registry.resolve(req);
    const handler = passthroughHandlers[provider.name];

    if (handler) {
      return handler.handle(req, res);
    }
  }
  next();
});
```

## Claude Code Integration

### Configuration

```bash
# Point Claude Code to LLMFlow passthrough
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic

# Or use environment variable
export ANTHROPIC_API_KEY=your-key

# Run Claude Code
claude
```

### Verification

```bash
# Check traces in LLMFlow
curl http://localhost:3000/api/traces | jq '.traces | .[0]'

# Should show:
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "span_name": "passthrough",
  "request_path": "/v1/messages",
  ...
}
```

## Provider-Specific Details

### Anthropic

| Endpoint             | Path                                 |
| -------------------- | ------------------------------------ |
| Messages             | `/v1/messages`                       |
| Messages (streaming) | `/v1/messages` (with `stream: true`) |

**Headers**:

- `x-api-key`: API key
- `anthropic-version`: API version (e.g., `2023-06-01`)

**Usage Location**: `response.usage.input_tokens`, `response.usage.output_tokens`

### Google Gemini

| Endpoint         | Path                                           |
| ---------------- | ---------------------------------------------- |
| Generate Content | `/v1beta/models/{model}:generateContent`       |
| Stream Generate  | `/v1beta/models/{model}:streamGenerateContent` |

**Headers**:

- `x-goog-api-key`: API key

**Usage Location**: `response.usageMetadata.promptTokenCount`, `response.usageMetadata.candidatesTokenCount`

### OpenAI (Native)

For tools using native OpenAI format but needing passthrough:

| Endpoint         | Path                   |
| ---------------- | ---------------------- |
| Chat Completions | `/v1/chat/completions` |
| Responses        | `/v1/responses`        |

**Headers**:

- `Authorization`: `Bearer <key>`

**Usage Location**: `response.usage.prompt_tokens`, `response.usage.completion_tokens`

## Dashboard Enhancements

### Filter by Passthrough

```javascript
// Add passthrough filter to traces API
app.get("/api/traces", (req, res) => {
  const { passthrough } = req.query;

  let traces = db.getTraces({
    filters: {
      ...req.query,
      span_name: passthrough === "true" ? "passthrough" : undefined,
    },
  });

  res.json({ traces });
});
```

### Passthrough Stats

```javascript
// GET /api/stats/passthrough
app.get("/api/stats/passthrough", (req, res) => {
  const stats = db
    .prepare(
      `
        SELECT 
            provider,
            COUNT(*) as request_count,
            SUM(total_tokens) as total_tokens,
            SUM(estimated_cost) as total_cost,
            AVG(duration_ms) as avg_duration
        FROM traces
        WHERE span_name = 'passthrough'
        GROUP BY provider
    `,
    )
    .all();

  res.json({ stats });
});
```

## Security Considerations

### API Key Handling

1. **Never log API keys**: Strip from logged headers
2. **Pass through securely**: Use HTTPS to upstream
3. **Support environment-based keys**: Allow server-side key injection

```javascript
headerTransform: (headers) => {
  // Use environment variable if client doesn't provide key
  const apiKey = headers["x-api-key"] || process.env.ANTHROPIC_API_KEY;

  // Don't log the actual key
  const safeHeaders = { ...headers };
  delete safeHeaders["x-api-key"];
  delete safeHeaders["authorization"];

  return {
    "x-api-key": apiKey,
    // ... other headers
  };
};
```

### Rate Limiting

Consider rate limiting passthrough to prevent abuse:

```javascript
const rateLimit = require("express-rate-limit");

const passthroughLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: "Too many requests to passthrough" },
});

proxyApp.use("/passthrough", passthroughLimiter);
```

## Testing

### Unit Tests

```javascript
describe("Passthrough Mode", () => {
  it("should forward Anthropic requests without transformation", async () => {
    const req = {
      path: "/v1/messages",
      headers: { "x-api-key": "test-key", "anthropic-version": "2023-06-01" },
      body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        system: "You are helpful",
        messages: [{ role: "user", content: "Hi" }],
      },
    };

    // Body should be forwarded as-is
    const forwarded = await handler.forward(
      req,
      handler.headerTransform(req.headers),
    );
    expect(forwarded.body.model).to.equal("claude-sonnet-4-20250514");
  });

  it("should extract usage from Anthropic response", () => {
    const response = {
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    const usage = handler.extractUsage(response);
    expect(usage.prompt_tokens).to.equal(10);
    expect(usage.completion_tokens).to.equal(20);
  });
});
```

### Integration Test

```bash
#!/bin/bash
# test-passthrough.sh

# Start LLMFlow
npm start &
sleep 2

# Test Anthropic passthrough
curl -X POST http://localhost:8080/passthrough/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Say hello"}]
  }'

# Verify trace was logged
curl http://localhost:3000/api/traces | jq '.traces | .[0].provider'
# Expected: "anthropic"
```

## Migration Path

### Phase 1: Core Passthrough (1 week)

1. Implement `PassthroughHandler` base class
2. Add Anthropic passthrough
3. Add `/passthrough/` routes

### Phase 2: Additional Providers (1 week)

1. Add Gemini passthrough
2. Add OpenAI passthrough (for tools using native format)
3. Add streaming support

### Phase 3: Claude Code Testing (1 week)

1. Test with Claude Code
2. Document configuration
3. Create example script

## Future Enhancements

1. **Auto-detection**: Detect native vs. transformed requests automatically
2. **Bidirectional transformation**: Transform responses to OpenAI format if requested
3. **Provider discovery**: Auto-discover provider from request structure
4. **Caching**: Cache identical requests for cost savings
5. **Request modification**: Allow header/body modification rules

## References

- [Anthropic API Reference](https://docs.anthropic.com/en/api/messages)
- [Google Gemini API Reference](https://ai.google.dev/api/rest)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- Current LLMFlow provider implementation: [providers/anthropic.js](../../providers/anthropic.js)
