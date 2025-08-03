# LLMFlow - LLM Observability and Monitoring

**Self-hosted, Open Source, Free LLM Observability Platform**

LLMFlow is a lightweight, self-hosted monitoring solution for LLM API calls - think of it as Laravel Telescope but for your AI applications. Perfect for hobbyists, side projects, and anyone who needs essential LLM observability without the enterprise price tag.

## What is LLMFlow?

LLMFlow provides real-time visibility into your LLM API usage without the complexity of enterprise solutions. It's designed for developers who want to:

- **Monitor** token usage, costs, and API performance
- **Debug** LLM interactions with detailed request/response logging
- **Trace** complex LLM chains and agent workflows
- **Visualize** latency patterns and error rates

Unlike platforms like Helicone or Langfuse, LLMFlow focuses on the essentials - no prompt libraries, no complex evaluation frameworks, just the core observability features you need to understand what's happening in your LLM-powered applications.

## How It Works

LLMFlow operates through two main components that work together to capture and visualize your LLM interactions:

### 1. The Proxy Server
The proxy acts as a transparent middleman between your application and LLM providers. When you send a request to the LLMFlow proxy instead of directly to OpenAI or Anthropic, it:
- Forwards your request to the actual LLM provider
- Captures the request details (prompts, parameters, headers)
- Measures response time and streaming performance
- Logs the complete response including token usage
- Stores everything in MongoDB with OpenLLMetry-compatible spans
- Returns the response to your application unchanged

### 2. The Dashboard
A web interface that connects to the same MongoDB instance and provides:
- Real-time view of incoming requests
- Trace visualization showing the flow of multi-step LLM operations
- Metrics aggregation for costs, latency, and errors
- Search and filtering capabilities
- Detailed request/response inspection

## Architecture Overview

```
Your App → LLMFlow Proxy (:8080) → OpenAI/Anthropic/etc
                ↓
            MongoDB ← Dashboard (:3000)
```

The proxy captures data following the OpenLLMetry specification, creating spans that include:
- Unique trace and span IDs for correlation
- Timestamp and duration measurements
- Model name and parameters
- Token counts (prompt and completion)
- Full request/response payloads
- Error details if requests fail
- Custom attributes you add via headers

## Key Features

### 🔍 OpenLLMetry-Compatible Tracing
- Full span tracing following the [OpenLLMetry](https://github.com/traceloop/openllmetry) specification
- Visualize nested LLM calls, tool usage, and agent workflows
- Track parent-child relationships in complex chains

### 📊 Essential Metrics
- **Token Usage**: Track input/output tokens per request, model, and time period
- **Latency Monitoring**: Response times, time-to-first-token, streaming performance
- **Error Tracking**: Capture and analyze API errors, rate limits, and failures
- **Cost Estimation**: Calculate usage costs based on model pricing

### 🔌 LLM Proxy
- Drop-in proxy for OpenAI, Anthropic, and other LLM APIs
- Zero-code instrumentation - just change your base URL
- Automatic request/response logging
- Minimal latency overhead (<10ms)

### 📈 Simple Dashboard
- Clean, functional UI for viewing traces and metrics
- Real-time updates as requests flow through
- Filter by model, status, time range
- Export data for further analysis

### 🐳 Docker-First Design
- Single `docker-compose up` to get started
- MongoDB for simple, scalable storage
- Minimal resource requirements
- Works great on a $5 VPS or your local machine

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/llmflow.git
cd llmflow

# Start with Docker Compose
docker-compose up -d

# Access the dashboard
open http://localhost:3000
```

Default credentials:
- Username: `llmflow`
- Password: `password`

## Configuration

Configure LLMFlow via environment variables in your `docker-compose.yml`:

```yaml
environment:
  - MONGO_URI=mongodb://mongo:27017/llmflow
  - AUTH_USERNAME=llmflow
  - AUTH_PASSWORD=your-secure-password
  - PORT=3000
  - PROXY_PORT=8080
  - RETENTION_DAYS=30  # Auto-delete old traces
  - MAX_RESPONSE_SIZE=1MB  # Truncate large responses
```

## Integration Examples

### Python (OpenAI)

Using LLMFlow with the OpenAI Python client is straightforward - just change the base URL:

```python
from openai import OpenAI

# Point to LLMFlow proxy instead of OpenAI directly
client = OpenAI(
    base_url="http://localhost:8080/v1",  # LLMFlow proxy
    api_key="sk-your-actual-openai-key"   # Your real API key
)

# Use the client normally - all calls are automatically logged
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    temperature=0.7,
    max_tokens=150
)

print(response.choices[0].message.content)

# Stream responses are also captured
stream = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Write a haiku about programming"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end='')
```

### JavaScript/Node.js (OpenAI)

For Node.js applications, the setup is equally simple:

```javascript
import OpenAI from 'openai';

// Configure the client to use LLMFlow proxy
const openai = new OpenAI({
  baseURL: 'http://localhost:8080/v1',  // LLMFlow proxy endpoint
  apiKey: process.env.OPENAI_API_KEY,    // Your actual OpenAI key
});

// Standard chat completion - automatically logged
async function askQuestion() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'What are the benefits of TypeScript?' }
    ],
    temperature: 0.5,
  });

  console.log(completion.choices[0].message.content);
}

// Function calling example - traces capture tool usage
async function functionCallingExample() {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'What\'s the weather in San Francisco?' }
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }
    }],
    tool_choice: 'auto',
  });

  // LLMFlow captures both the LLM call and tool usage
  console.log(response.choices[0].message);
}

// Streaming with proper error handling
async function streamExample() {
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Count to 10 slowly' }],
      stream: true,
    });

    // LLMFlow tracks streaming metrics like time-to-first-token
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content || '');
    }
  } catch (error) {
    // Errors are captured with full context in LLMFlow
    console.error('Streaming failed:', error);
  }
}
```

### PHP (OpenAI)

PHP applications can use LLMFlow with any OpenAI-compatible client:

```php
<?php
require 'vendor/autoload.php';

use OpenAI\Client;

// Create client pointing to LLMFlow proxy
$client = OpenAI::factory()
    ->withBaseUri('http://localhost:8080/v1')  // LLMFlow proxy
    ->withApiKey($_ENV['OPENAI_API_KEY'])       // Your actual API key
    ->withHttpClient(new \GuzzleHttp\Client([
        'timeout' => 30,
    ]))
    ->make();

// Simple completion - automatically tracked
$response = $client->chat()->create([
    'model' => 'gpt-3.5-turbo',
    'messages' => [
        ['role' => 'user', 'content' => 'Write a PHP function to validate email addresses']
    ],
    'temperature' => 0.3,
    'max_tokens' => 200,
]);

echo $response->choices[0]->message->content;

// Async streaming example with error handling
$stream = $client->chat()->createStreamed([
    'model' => 'gpt-4',
    'messages' => [
        ['role' => 'system', 'content' => 'You are a PHP expert.'],
        ['role' => 'user', 'content' => 'Explain PHP generators with an example']
    ],
    'stream' => true,
]);

// LLMFlow captures the entire streamed response
foreach ($stream as $response) {
    $content = $response->choices[0]->delta->content ?? '';
    echo $content;
    
    // Flush output for real-time display
    if (ob_get_level() > 0) {
        ob_flush();
    }
    flush();
}

// Using with Laravel - add to config/services.php
return [
    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'base_uri' => env('LLMFLOW_PROXY_URL', 'http://localhost:8080/v1'),
    ],
];

// Laravel service provider example
class AIService 
{
    private Client $client;
    
    public function __construct()
    {
        $this->client = OpenAI::factory()
            ->withBaseUri(config('services.openai.base_uri'))
            ->withApiKey(config('services.openai.api_key'))
            ->make();
    }
    
    public function summarize(string $text): string 
    {
        // This call will appear in LLMFlow with full context
        $response = $this->client->chat()->create([
            'model' => 'gpt-3.5-turbo',
            'messages' => [
                ['role' => 'system', 'content' => 'Summarize the following text concisely.'],
                ['role' => 'user', 'content' => $text]
            ],
            'temperature' => 0.5,
            'max_tokens' => 150,
        ]);
        
        return $response->choices[0]->message->content;
    }
}
```

## What Data is Captured

For each LLM request, LLMFlow captures and stores:

### Request Information
- Timestamp and unique trace ID
- Model name and provider
- All messages (system, user, assistant)
- Temperature, max_tokens, and other parameters
- Custom headers (useful for tagging requests)
- API endpoint and HTTP method

### Response Data
- Complete response content
- Token usage (prompt_tokens, completion_tokens, total_tokens)
- Response time and streaming metrics
- Finish reason (stop, length, tool_calls, etc.)
- Any tool/function calls made

### Performance Metrics
- End-to-end latency
- Time to first token (for streaming)
- Token generation rate
- Queue time (if applicable)

### Error Tracking
- HTTP status codes
- Error messages and types
- Rate limit information
- Retry attempts

## Dashboard Features

The web dashboard provides several views to help you understand your LLM usage:

### Traces View
See all LLM calls in chronological order with:
- Request preview (first few words of prompt)
- Model and token usage
- Response time and status
- Click any trace to see full details

### Trace Details
Detailed view of a single LLM interaction showing:
- Complete request and response payloads
- Token breakdown and estimated costs
- Timing information and waterfall view
- Error details if the request failed
- Related spans for multi-step operations

### Analytics Dashboard
Simple charts and metrics including:
- Requests per hour/day
- Token usage over time
- Cost breakdown by model
- Average latency trends
- Error rate monitoring

### Search and Filters
Find specific requests by:
- Time range
- Model name
- Status (success/error)
- Token usage thresholds
- Custom trace attributes

## Advanced Usage

### Adding Custom Attributes

Add metadata to your traces using headers:

```python
# Python example
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="your-key",
    default_headers={
        "X-Trace-User-Id": "user-123",
        "X-Trace-Session-Id": "session-abc",
        "X-Trace-Feature": "chat-widget"
    }
)
```

### Tracing Complex Workflows

For multi-step LLM operations, use trace IDs to correlate requests:

```javascript
// JavaScript example
const traceId = crypto.randomUUID();

// First LLM call
const planResponse = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Plan a trip to Tokyo' }],
  headers: { 'X-Trace-Id': traceId, 'X-Trace-Step': 'planning' }
});

// Second LLM call using the plan
const detailsResponse = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: 'You are a travel guide.' },
    { role: 'user', content: `Expand on this plan: ${planResponse.choices[0].message.content}` }
  ],
  headers: { 'X-Trace-Id': traceId, 'X-Trace-Step': 'details' }
});
```

## Data Storage and Retention

LLMFlow uses MongoDB to store trace data with the following schema:

```javascript
{
  "_id": "507f1f77bcf86cd799439011",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "spanId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "parentSpanId": null,
  "service": "my-app",
  "operation": "chat.completions.create",
  "startTime": "2024-01-20T10:30:00.000Z",
  "endTime": "2024-01-20T10:30:02.500Z",
  "duration": 2500,
  "status": "success",
  "attributes": {
    "model": "gpt-3.5-turbo",
    "provider": "openai",
    "temperature": 0.7,
    "max_tokens": 150,
    "prompt_tokens": 50,
    "completion_tokens": 120,
    "total_tokens": 170,
    "estimated_cost": 0.00034
  },
  "request": {
    "messages": [...],
    "parameters": {...}
  },
  "response": {
    "choices": [...],
    "usage": {...}
  },
  "error": null
}
```

Data is automatically cleaned up based on the `RETENTION_DAYS` setting (default: 30 days).

## Security Notes

LLMFlow includes basic authentication but is designed for trusted environments:
- Change default credentials immediately
- Use HTTPS in production (reverse proxy recommended)
- Consider network isolation for sensitive deployments
- API keys pass through the proxy unmodified
- Request/response data is stored unencrypted in MongoDB

## Performance Considerations

LLMFlow is designed to have minimal impact on your application:
- Proxy adds <10ms latency in most cases
- Async logging doesn't block your requests
- MongoDB handles thousands of writes per second
- Dashboard queries are optimized with proper indexing
- Large responses can be truncated to save space

## Troubleshooting

Common issues and solutions:

**Proxy returns 401 Unauthorized**
- Check that you're passing your actual API key, not the LLMFlow credentials
- Verify the API key works directly with the provider

**Dashboard shows no data**
- Ensure your app is pointing to the proxy port (8080 by default)
- Check MongoDB connection in docker logs
- Verify proxy is receiving requests in proxy logs

**High memory usage**
- Adjust `MAX_RESPONSE_SIZE` to truncate large responses
- Reduce `RETENTION_DAYS` to clean up old data faster
- Add MongoDB memory limits in docker-compose.yml

## Roadmap

- [ ] Support for more LLM providers (Cohere, Hugging Face, etc.)
- [ ] Customizable retention policies
- [ ] Webhooks for alerts
- [ ] Simple cost budgets and notifications
- [ ] CSV/JSON export functionality
- [ ] Dark mode

## Contributing

We welcome contributions! LLMFlow is meant to stay simple and focused. Before adding features, ask:
- Does this help developers understand their LLM usage?
- Can it be implemented without external dependencies?
- Will it work in a single-container deployment?

## License

MIT License - Use it, modify it, deploy it anywhere.

## Alternatives

If LLMFlow doesn't meet your needs, consider:
- **[Helicone](https://helicone.ai)**: Full-featured observability platform
- **[Langfuse](https://langfuse.com)**: Open source with more features
- **[Weights & Biases](https://wandb.ai)**: For ML experiment tracking
- **[OpenLLMetry](https://github.com/traceloop/openllmetry)**: Just the SDK

---

*Built for developers who ship LLM features, not manage LLM platforms.*