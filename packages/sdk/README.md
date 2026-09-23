# llmflow-sdk

Tracing SDK for LLM applications. Wrap the steps of your pipeline in spans, and the SDK
reports them to a running [LLMFlow](https://github.com/HelgeSverre/llmflow) instance, where they
appear alongside the LLM calls made through the LLMFlow proxy.

```bash
npm install llmflow-sdk
```

The package is ESM-only and runs on Node.js 18+ and Bun. From CommonJS, load it with
`await import('llmflow-sdk')`.

## Quick start

```js
import OpenAI from 'openai'
import { currentTraceHeaders, span, trace } from 'llmflow-sdk'

// LLM calls go through the LLMFlow proxy, which records them.
const openai = new OpenAI({ baseURL: 'http://127.0.0.1:8080/v1' })

const answer = await trace('answer-question', async () => {
  const docs = await span('retrieval', 'search_docs', () => vectorStore.search('refund policy'))

  const response = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: docs.join('\n') },
        { role: 'user', content: 'What is the refund policy?' },
      ],
    },
    // Links the proxied LLM call to the current span.
    { headers: currentTraceHeaders() },
  )
  return response.choices[0].message.content
})
```

## API

### `trace(name, fn, options?)`

Runs `fn` as the root span of a new trace (span type `trace`) and returns its result. Spans
created inside `fn` become its children. `options` accepts the fields of
[`SpanOptions`](#spanoptions) except that `type`, `name` and `traceId` are set for you unless you
override them.

```js
await trace('nightly-report', () => buildReport(), { tags: ['cron'], serviceName: 'reports' })
```

### `span(type, name, fn)` / `span(options, fn)`

Runs `fn` in a new span and returns its result. Inside a `trace()` or another `span()` the new
span is a child of the current one; outside, it starts a new trace. `fn` may be synchronous or
async.

```js
const hits = await span('retrieval', 'vector_search', () => index.query(embedding))

await span(
  {
    type: 'tool',
    name: 'send_email',
    input: { to },
    attributes: { provider: 'ses' },
    tags: ['notifications'],
  },
  () => sendEmail(to, body),
)
```

When `fn` settles, the span is sent to LLMFlow with its duration, the returned value as
output (primitives are wrapped as `{ result }`), and status `200`. If `fn` throws, the span is
sent with status `500` and the error message, and the error is rethrown.

### `SpanOptions`

| Field         | Type                      | Description                                                    |
| ------------- | ------------------------- | -------------------------------------------------------------- |
| `type`        | `SpanType`                | See [span types](#span-types)                                  |
| `name`        | `string`                  | Shown in the dashboard                                         |
| `traceId`     | `string`                  | Put the span in this trace instead of the current or a new one |
| `input`       | `unknown`                 | Recorded as the span input                                     |
| `attributes`  | `Record<string, unknown>` | Custom attributes                                              |
| `tags`        | `string[]`                | Tags for filtering                                             |
| `serviceName` | `string`                  | Service name; defaults to `unknown_service`                    |

### `traced(type, name?)`

A method decorator that runs every call of an async method in a span. The span name defaults to
the method name. It works with standard decorators (TypeScript 5+) and with
`experimentalDecorators`.

```ts
class Agent {
  @traced('agent')
  async plan(goal: string) {
    /* ... */
  }

  @traced('tool', 'web_search')
  async search(query: string) {
    /* ... */
  }
}
```

### `currentTraceHeaders()`

Returns `{ 'x-trace-id', 'x-parent-id' }` for the current span, or `{}` outside one. Send these
headers with LLM calls that go through the LLMFlow proxy to attach them to the span tree.

### `wrapOpenAI(client)`

Patches an OpenAI client so every `client.chat.completions.create()` call sends
`currentTraceHeaders()`. Returns the same client.

```js
const openai = wrapOpenAI(new OpenAI({ baseURL: 'http://127.0.0.1:8080/v1' }))
await trace('chat', () => openai.chat.completions.create({ model: 'gpt-4o-mini', messages }))
```

### `getCurrentSpan()`

Returns the current `SpanContext` (`{ spanId, traceId, parentId }`), or `null` outside a span.

### `generateId()`

Returns a random UUID, the ID format LLMFlow uses for spans and traces.

### Types

`SpanOptions`, `SpanContext`, `SpanType`, `TraceHeaders` and `TracedDecorator` are exported for
TypeScript users.

## Span types

`SpanType` accepts any string; these values get dedicated styling in the dashboard:

| Type        | Use for                        |
| ----------- | ------------------------------ |
| `trace`     | Root spans (set by `trace()`)  |
| `llm`       | LLM calls                      |
| `agent`     | Agent loops and steps          |
| `chain`     | Pipeline or chain steps        |
| `tool`      | Tool and function calls        |
| `retrieval` | Vector search, document lookup |
| `embedding` | Embedding generation           |
| `custom`    | Anything else                  |

## Configuration

| Variable          | Default                 | Description                                                |
| ----------------- | ----------------------- | ---------------------------------------------------------- |
| `LLMFLOW_URL`     | `http://127.0.0.1:1337` | LLMFlow dashboard URL; spans are sent to `POST /api/spans` |
| `LLMFLOW_VERBOSE` | unset                   | Print network errors when a span cannot be sent            |

Both are read once, when the SDK is imported. Spans are sent in the background and never throw
into your code: an unreachable server is silent unless `LLMFLOW_VERBOSE` is set, and a rejected
span prints one `[llmflow]` line.

## How it works

The SDK keeps the current span in Node's `AsyncLocalStorage`, so the context follows `await`,
`Promise.all` and callbacks. Each span is sent to LLMFlow as JSON when it finishes. LLM calls
made through the proxy with `x-trace-id` / `x-parent-id` headers are stored as children of the
span that made them.

## License

MIT
