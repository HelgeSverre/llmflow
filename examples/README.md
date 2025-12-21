# LLMFlow Integration Examples

This folder contains working examples of LLMFlow integrations with popular LLM frameworks.

## Examples

| Example                          | Description                      | Features                                                                 |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| [langchain](./langchain)         | LangChain.js via LLMFlow proxy   | Basic tracing                                                            |
| [ai-sdk-proxy](./ai-sdk-proxy)   | Vercel AI SDK via LLMFlow proxy  | Basic tracing                                                            |
| [vercel-ai-sdk](./vercel-ai-sdk) | Vercel AI SDK via proxy          | Basic tracing                                                            |
| [rag-pipeline](./rag-pipeline)   | RAG pipeline with LLMFlow SDK    | **Hierarchical spans**, parent-child relationships, input/output capture |
| [claude-code](./claude-code)     | Claude Code CLI OTEL exploration | ⚠️ Metrics/logs only (not traces)                                        |

## Quick Start

1. **Configure environment** (from project root):

   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

2. **Start LLMFlow**:

   ```bash
   npm install
   npm start
   ```

3. **Run all examples**:

   ```bash
   make examples
   ```

4. **View traces** at [http://localhost:3000](http://localhost:3000)

> **Note:** Examples automatically load the `.env` file from the project root, so you only need one `.env` file.

## Integration Methods

### Method 1: OpenAI Proxy (Recommended)

Point your LLM SDK at the LLMFlow proxy to automatically capture all LLM calls:

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
});
```

Or with LangChain:

```javascript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  configuration: {
    baseURL: "http://localhost:8080/v1",
  },
});
```

Or with Vercel AI SDK:

```javascript
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Method 2: LLMFlow SDK (Manual Spans)

For custom workflows, use the LLMFlow SDK directly:

```javascript
import { trace, span, currentTraceHeaders } from "llmflow-sdk";

await trace("my-pipeline", async () => {
  const docs = await span("retrieval", "vector-search", async () => {
    return await vectorDB.search(query);
  });

  const response = await openai.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: query }],
    },
    {
      headers: currentTraceHeaders(),
    },
  );
});
```

### Method 3: OpenTelemetry (OTLP)

Send traces via the OTLP/HTTP endpoint:

```javascript
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

new OTLPTraceExporter({
  url: "http://localhost:3000/v1/traces",
});
```

## Environment Variables

All examples use the `.env` file from the project root. See `.env.example` for all available options.

| Variable         | Required | Description                                              |
| ---------------- | -------- | -------------------------------------------------------- |
| `OPENAI_API_KEY` | Yes      | Your OpenAI API key                                      |
| `LLMFLOW_URL`    | No       | LLMFlow dashboard URL (default: `http://localhost:3000`) |
| `LLMFLOW_PROXY`  | No       | LLMFlow proxy URL (default: `http://localhost:8080/v1`)  |

## Adding New Examples

1. Create a folder in `examples/`
2. Add a `package.json` with dependencies
3. Add an `index.js` with the integration code
4. Add a `README.md` explaining the setup
5. Update this README with the new example
