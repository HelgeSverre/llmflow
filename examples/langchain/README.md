# LangChain + LLMFlow Proxy Example

This example demonstrates how to trace LangChain.js applications with LLMFlow by routing API calls through the proxy.

## How It Works

LangChain is configured to send OpenAI API calls through the LLMFlow proxy at `http://localhost:8080/v1`. The proxy:

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
import { ChatOpenAI } from "@langchain/openai";

// Configure LangChain to use LLMFlow proxy
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  configuration: {
    baseURL: "http://localhost:8080/v1",
  },
});
```

## What Gets Traced

LLMFlow automatically captures:

- **Model**: The LLM model used (e.g., `gpt-4o-mini`)
- **Tokens**: Input and output token counts
- **Messages**: The messages sent to the model
- **Completions**: The model's responses
- **Duration**: How long each call took
- **Cost**: Estimated cost based on token usage

## Configuration

| Variable            | Default                    | Description                      |
| ------------------- | -------------------------- | -------------------------------- |
| `LLMFLOW_PROXY`     | `http://localhost:8080/v1` | LLMFlow proxy URL                |
| `LLMFLOW_DASHBOARD` | `http://localhost:3000`    | Dashboard URL for viewing traces |
| `OPENAI_API_KEY`    | (required)                 | Your OpenAI API key              |
