# LLMFlow Integration Examples

This folder contains working examples of LLMFlow integrations with popular LLM frameworks.

## Examples

| Example | Description | Framework |
|---------|-------------|-----------|
| [langchain](./langchain) | LangChain.js with OpenLLMetry | LangChain |
| [vercel-ai-sdk](./vercel-ai-sdk) | Vercel AI SDK with built-in telemetry | Vercel AI SDK |
| [voltagent](./voltagent) | VoltAgent with OpenTelemetry | VoltAgent |

## Quick Start

1. **Start LLMFlow** (from project root):
   ```bash
   npm install
   npm start
   ```

2. **Choose an example** and follow its README

3. **View traces** at [http://localhost:3000](http://localhost:3000)

## Integration Methods

### Method 1: LLMFlow SDK (Manual Spans)

For custom workflows, use the LLMFlow SDK directly:

```javascript
import { trace, span, currentTraceHeaders } from 'llmflow-sdk';

await trace('my-pipeline', async () => {
    const docs = await span('retrieval', 'vector-search', async () => {
        return await vectorDB.search(query);
    });
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: query }]
    }, { 
        headers: currentTraceHeaders() 
    });
});
```

### Method 2: OpenAI Proxy (Zero Code)

Point your OpenAI SDK at the LLMFlow proxy:

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:8080/v1'
});
```

### Method 3: OpenTelemetry (OTLP)

Send traces via the OTLP/HTTP endpoint:

```javascript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

new OTLPTraceExporter({
    url: 'http://localhost:3000/v1/traces'
});
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLMFLOW_URL` | `http://localhost:3000` | LLMFlow server URL |
| `OPENAI_API_KEY` | - | Your OpenAI API key |

## Adding New Examples

1. Create a folder in `examples/`
2. Add a `package.json` with dependencies
3. Add an `index.js` with the integration code
4. Add a `README.md` explaining the setup
5. Update this README with the new example
