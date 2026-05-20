# LLMFlow v0.2.0

**Trace every LLM call. See the full picture.**

This is the first public release of LLMFlow - a local-first observability tool for LLM applications.

## ✨ Highlights

- **Hierarchical span tracing** - Visualize the complete execution flow of your AI pipelines
- **Multiple integration methods** - Zero-code proxy, JavaScript SDK, or OpenTelemetry
- **OTLP/HTTP support** - Works with OpenTelemetry, OpenLLMetry, and any OTEL-compatible tool
- **Cost tracking** - Real-time pricing for 2000+ LLM models
- **Local-first** - SQLite storage, no cloud dependencies

## 🚀 Quick Start

```bash
git clone https://github.com/HelgeSverre/llmflow.git
cd llmflow
npm install && npm start
```

- Dashboard: http://localhost:3000
- Proxy: http://localhost:8080

## 📦 What's Included

### Integration Methods

1. **Zero-code Proxy** - Point your OpenAI SDK at `http://localhost:8080/v1`
2. **JavaScript SDK** - Create custom spans with `trace()` and `span()`
3. **OTLP/HTTP Endpoint** - `POST /v1/traces` for OpenTelemetry exporters

### Framework Support

Works out of the box with:

- LangChain (via OpenLLMetry)
- Vercel AI SDK (built-in telemetry)
- VoltAgent
- LlamaIndex
- CrewAI
- Any OpenTelemetry-instrumented framework

### Features

| Feature                        | Status |
| ------------------------------ | ------ |
| Hierarchical span tracing      | ✅     |
| Span tree visualization        | ✅     |
| JavaScript SDK                 | ✅     |
| SQLite storage                 | ✅     |
| Dynamic pricing (2000+ models) | ✅     |
| Streaming support              | ✅     |
| Search & filtering             | ✅     |
| OTLP/HTTP support              | ✅     |

## 📁 New in This Release

- **ES Module SDK** - Now uses `import`/`export` syntax
- **Examples folder** - Complete integration examples for LangChain, Vercel AI SDK, and VoltAgent
- **RELEASING.md** - Documented release process
- **Updated documentation** - SDK installation instructions

## 🔧 SDK Installation

```bash
# From GitHub
npm install github:HelgeSverre/llmflow#v0.2.0

# Or link locally
cd llmflow/sdk && npm link
```

```javascript
import { trace, span, currentTraceHeaders } from "llmflow-sdk";

await trace("my-pipeline", async () => {
  const docs = await span("retrieval", "search", async () => {
    return await vectorDB.search(query);
  });
});
```

## 📖 Documentation

- [README](https://github.com/HelgeSverre/llmflow#readme)
- [Examples](https://github.com/HelgeSverre/llmflow/tree/main/examples)
- [PLAN.md](https://github.com/HelgeSverre/llmflow/blob/main/PLAN.md)

## 🐳 Docker

```bash
docker-compose up
```

## 📄 License

MIT © Helge Sverre
