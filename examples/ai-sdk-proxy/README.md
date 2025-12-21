# Vercel AI SDK + LLMFlow Proxy Example

This example shows how to trace Vercel AI SDK applications by routing API calls through the LLMFlow proxy.

## How it works

Instead of calling OpenAI directly, we configure the AI SDK to route requests through the LLMFlow proxy at `http://localhost:8080/v1`. The proxy:

1. Logs the request
2. Forwards it to OpenAI
3. Logs the response with token usage and cost
4. Returns the response to your app

## Setup

1. Start LLMFlow from the project root:

   ```bash
   npm start
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the example:

   ```bash
   npm start
   ```

4. View traces at [http://localhost:3000](http://localhost:3000)

## Key Code

```javascript
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// Create OpenAI client that routes through LLMFlow proxy
const openai = createOpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

// Use as normal - all calls are traced
const { text } = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Hello!",
});
```

## Comparison with OTLP

This example uses the **proxy approach** which is:

- Simpler to set up (just change the base URL)
- Captures full request/response data
- Shows token usage and cost

The OTLP approach requires OpenTelemetry setup but provides:

- Integration with existing observability infrastructure
- Custom span attributes
- Distributed tracing across services
