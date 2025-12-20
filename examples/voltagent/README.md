# VoltAgent + LLMFlow Example

This example demonstrates how to trace VoltAgent applications with LLMFlow.

## How It Works

VoltAgent has built-in observability support. This example uses OpenTelemetry to export traces to LLMFlow's OTLP endpoint.

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

## VoltAgent Features

VoltAgent provides:

- **Agent orchestration** - Multi-agent workflows with supervisor coordination
- **Tool calling** - Zod-typed tools with lifecycle hooks
- **Memory** - Durable memory adapters for context persistence
- **Built-in observability** - VoltOps platform integration

## What Gets Traced

LLMFlow captures from VoltAgent:

| Attribute | Description |
|-----------|-------------|
| Agent name | The agent handling the request |
| Model | LLM model used |
| Tools | Tool calls and results |
| Duration | Execution time |
| Token usage | Input/output tokens |

## Alternative: VoltOps Platform

VoltAgent also has its own observability platform (VoltOps). You can use both:

```javascript
import { LangfuseExporter } from '@voltagent/langfuse-exporter';

// Use VoltOps for VoltAgent-specific features
// Use LLMFlow for unified LLM observability across tools
```

## Configuration

Set `LLMFLOW_URL` to point to your LLMFlow instance:

```bash
export LLMFLOW_URL=http://localhost:3000
```
