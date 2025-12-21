# Vercel AI SDK + LLMFlow Proxy Example

This example demonstrates how to trace Vercel AI SDK applications with LLMFlow by routing API calls through the proxy.

## How It Works

The Vercel AI SDK is configured to send OpenAI API calls through the LLMFlow proxy at `http://localhost:8080/v1`. The proxy:

1. Logs the request
2. Forwards it to OpenAI
3. Logs the response with token usage and cost
4. Returns the response to your app

## Setup

1. Start LLMFlow from the project root:

   ```bash
   npm install
   npm start
   ```

2. Install example dependencies:

   ```bash
   npm install
   ```

3. Set your OpenAI API key in `.env` at the project root:

   ```bash
   OPENAI_API_KEY=sk-your-key
   ```

4. Run the example:

   ```bash
   npm start
   ```

5. View traces at [http://localhost:3000](http://localhost:3000)

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

## What Gets Traced

LLMFlow automatically captures:

| Attribute | Description                         |
| --------- | ----------------------------------- |
| Model     | The LLM model used                  |
| Tokens    | Input and output token counts       |
| Messages  | The messages sent to the model      |
| Response  | The model's response                |
| Duration  | How long each call took             |
| Cost      | Estimated cost based on token usage |

## Configuration

| Variable            | Default                    | Description                      |
| ------------------- | -------------------------- | -------------------------------- |
| `LLMFLOW_PROXY`     | `http://localhost:8080/v1` | LLMFlow proxy URL                |
| `LLMFLOW_DASHBOARD` | `http://localhost:3000`    | Dashboard URL for viewing traces |
| `OPENAI_API_KEY`    | (required)                 | Your OpenAI API key              |
