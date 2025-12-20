# Vercel AI SDK + LLMFlow Example

This example demonstrates how to trace Vercel AI SDK applications with LLMFlow.

## How It Works

The Vercel AI SDK has built-in telemetry support via `experimental_telemetry`. When enabled, it emits OpenTelemetry spans that LLMFlow can capture.

## Setup

1. Start LLMFlow:
   ```bash
   cd ../..
   npm install
   npm start
   ```

2. Install example dependencies:
   ```bash
   npm install
   ```

3. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=sk-your-key
   ```

4. Run the example:
   ```bash
   npm start
   ```

5. View traces at [http://localhost:3000](http://localhost:3000)

## Enabling Telemetry

Add `experimental_telemetry` to your AI SDK calls:

```javascript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: 'Hello, world!',
    experimental_telemetry: {
        isEnabled: true,
        functionId: 'my-function',
        metadata: {
            userId: 'user-123'
        }
    }
});
```

## What Gets Traced

LLMFlow automatically captures from Vercel AI SDK:

| Attribute | Description |
|-----------|-------------|
| `ai.model.id` | Model identifier |
| `ai.model.provider` | Provider (openai, anthropic, etc.) |
| `ai.usage.promptTokens` | Input tokens |
| `ai.usage.completionTokens` | Output tokens |
| `ai.prompt` | The prompt sent |
| `ai.response.text` | Generated response |
| `ai.response.finishReason` | Why generation stopped |

## Span Types

| AI SDK Operation | LLMFlow Type |
|------------------|--------------|
| `generateText` | `llm` |
| `streamText` | `llm` |
| `generateObject` | `llm` |
| `embed` | `embedding` |
| Tool calls | `tool` |

## Configuration

Set `LLMFLOW_URL` to point to your LLMFlow instance:

```bash
export LLMFLOW_URL=http://localhost:3000
```
