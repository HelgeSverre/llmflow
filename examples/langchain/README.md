# LangChain + LLMFlow Example

This example demonstrates how to trace LangChain.js applications with LLMFlow using OpenLLMetry.

## How It Works

LangChain traces are sent to LLMFlow via the OTLP/HTTP endpoint (`/v1/traces`). The integration uses:

- **@opentelemetry/sdk-node** - OpenTelemetry Node.js SDK
- **@opentelemetry/exporter-trace-otlp-http** - OTLP HTTP exporter
- **@traceloop/instrumentation-langchain** - Automatic LangChain instrumentation

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

## What Gets Traced

LLMFlow automatically captures:

- **Model**: The LLM model used (e.g., `gpt-4o-mini`)
- **Tokens**: Input and output token counts
- **Prompts**: The prompts sent to the model
- **Completions**: The model's responses
- **Duration**: How long each call took
- **Chain steps**: Each step in a LangChain pipeline

## Configuration

Set `LLMFLOW_URL` to point to your LLMFlow instance:

```bash
export LLMFLOW_URL=http://localhost:3000
```

## Span Types

LangChain spans are automatically categorized:

| OpenLLMetry Span | LLMFlow Type |
|------------------|--------------|
| `ChatOpenAI` | `llm` |
| `Chain` | `chain` |
| `Tool` | `tool` |
| `Retriever` | `retrieval` |
