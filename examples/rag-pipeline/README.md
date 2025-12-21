# RAG Pipeline + LLMFlow SDK Example

This example demonstrates **hierarchical span tracking** using the LLMFlow SDK. It shows how to create parent-child span relationships for complex LLM workflows.

## What This Example Shows

Unlike the simple proxy examples, this example creates a **trace tree** with multiple nested spans:

```
rag-query (trace)
├── embed_query (embedding)
├── vector_search (retrieval)
├── rerank_results (chain)
└── [LLM call] (llm) ← linked via x-trace-id header
```

And an agent workflow:

```
agent-task (trace)
├── think_step_1 (agent)
│   └── [LLM call] (llm)
├── search_knowledge_base (tool)
└── synthesize_answer (chain)
    └── [LLM call] (llm)
```

## How It Works

1. **LLMFlow SDK** (`trace()`, `span()`) creates the span hierarchy
2. **Proxy integration** captures LLM calls with full request/response data
3. **Trace propagation** via `x-trace-id` and `x-parent-id` headers links LLM calls to parent spans
4. The dashboard shows the complete trace tree with timing, tokens, and costs

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

### Creating a trace with nested spans

```javascript
import { trace, span, wrapOpenAI } from "../../sdk/index.js";
import OpenAI from "openai";

// Wrap OpenAI client to auto-inject trace headers
const openai = wrapOpenAI(
  new OpenAI({
    baseURL: "http://localhost:8080/v1",
  }),
);

await trace(
  "rag-query",
  async () => {
    // Embedding span
    const embedding = await span(
      {
        type: "embedding",
        name: "embed_query",
        input: { text: query },
      },
      async () => {
        return await generateEmbedding(query);
      },
    );

    // Retrieval span
    const docs = await span(
      {
        type: "retrieval",
        name: "vector_search",
        input: { top_k: 5 },
      },
      async () => {
        return await vectorDB.search(embedding);
      },
    );

    // LLM call - automatically linked to parent span
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: query }],
    });

    return response.choices[0].message.content;
  },
  {
    input: { query },
    tags: ["rag", "production"],
    serviceName: "rag-service",
  },
);
```

### Using wrapOpenAI for automatic header injection

```javascript
import { wrapOpenAI } from '../../sdk/index.js';

const openai = wrapOpenAI(new OpenAI({
    baseURL: 'http://localhost:8080/v1'
}));

// All calls automatically include x-trace-id and x-parent-id headers
await openai.chat.completions.create({ ... });
```

### Manual header injection

```javascript
import { currentTraceHeaders } from '../../sdk/index.js';

await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...]
}, {
    headers: currentTraceHeaders()
});
```

## Span Types

| Type        | Use Case                          |
| ----------- | --------------------------------- |
| `trace`     | Root span (auto-set by `trace()`) |
| `llm`       | LLM API calls (auto-set by proxy) |
| `agent`     | Agent execution steps             |
| `chain`     | Chain/pipeline steps              |
| `tool`      | Tool/function calls               |
| `retrieval` | Vector search, document lookup    |
| `embedding` | Embedding generation              |

## Viewing Traces

1. Open [http://localhost:3000](http://localhost:3000)
2. Find traces named "rag-query" or "agent-task"
3. Click to view the span tree
4. Each span shows:
   - Duration
   - Input/output data
   - Custom attributes
   - Token usage and cost (for LLM spans)

## Span Attributes

Each span can include:

```javascript
await span(
  {
    type: "retrieval",
    name: "vector_search",
    input: { query: "user query", top_k: 5 },
    attributes: { index: "main", metric: "cosine" },
    tags: ["vector-db", "pinecone"],
    serviceName: "retrieval-service",
  },
  async () => {
    // Your code here
  },
);
```
