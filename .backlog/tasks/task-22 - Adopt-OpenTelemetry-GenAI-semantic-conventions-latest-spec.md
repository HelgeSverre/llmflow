---
id: TASK-22
title: Adopt OpenTelemetry GenAI semantic conventions (latest spec)
status: To Do
assignee: []
created_date: '2026-05-27 14:00'
labels:
  - otel
  - semconv
  - genai
  - compatibility
dependencies: []
references:
  - packages/otlp/src/traces.js
  - packages/otlp/src/export.js
  - apps/server/test/demo.js
  - apps/server/test/otlp-e2e.js
  - 'https://opentelemetry.io/docs/specs/semconv/gen-ai/'
  - 'https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/'
  - 'https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/'
  - 'https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/'
  - 'https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/'
  - 'https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/'
modified_files:
  - packages/otlp/src/traces.js
  - packages/otlp/src/export.js
  - apps/server/test/demo.js
  - apps/server/test/otlp-e2e.js
  - docs/
priority: medium
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring LLMFlow in line with the current OpenTelemetry GenAI semantic conventions
(captured from the spec on 2026-05-27, status: **Development**). The current
OTLP transform (`packages/otlp/src/traces.js`) and demo generator
(`apps/server/test/demo.js`) read/emit only the v1.36.0-era attribute names
(`gen_ai.system`, `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`,
`gen_ai.prompt`, `gen_ai.completion`) — all of which are now **deprecated**.
The newer instrumentations (OpenLLMetry, OpenInference, Vercel AI SDK,
Anthropic/OpenAI native SDKs that adopt the spec) will increasingly emit the
renamed attributes, and the spec's recommended migration pattern is the
`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` environment flag.

This task captures the full spec surface in one place and tracks the work to
(a) accept both old and new attribute shapes in ingest, (b) emit the new shape
in the OTLP export, (c) rewrite the demo to be spec-compliant, and (d) record
new fields (reasoning tokens, cache tokens, response.finish_reasons, request
params) that we currently drop on the floor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OTLP ingest accepts BOTH old (`gen_ai.system`, `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`, `gen_ai.prompt`, `gen_ai.completion`) and new (`gen_ai.provider.name`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.input.messages`, `gen_ai.output.messages`) attribute names without regressing existing tests
- [ ] #2 `gen_ai.operation.name` is read and surfaced — used to derive span_type (chat/text_completion → llm, embeddings → embedding, execute_tool → tool, invoke_agent/create_agent → agent, invoke_workflow → trace/chain, retrieval → retrieval)
- [ ] #3 New token fields captured into DB or attributes blob: `gen_ai.usage.cache_creation.input_tokens`, `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.reasoning.output_tokens` (so o1-style and Anthropic prompt-caching usage is visible)
- [ ] #4 Response fields captured: `gen_ai.response.id`, `gen_ai.response.model`, `gen_ai.response.finish_reasons`, `gen_ai.response.time_to_first_chunk`
- [ ] #5 Request parameters captured: `gen_ai.request.temperature`, `top_p`, `top_k`, `max_tokens`, `frequency_penalty`, `presence_penalty`, `stop_sequences`, `seed`, `choice.count`, `stream`, `encoding_formats`
- [ ] #6 Structured message attributes `gen_ai.input.messages` / `gen_ai.output.messages` parsed and used as input/output when present (preferring them over the deprecated `gen_ai.prompt` / `gen_ai.completion`)
- [ ] #7 Agent/workflow attributes captured: `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.description`, `gen_ai.agent.version`, `gen_ai.workflow.name`
- [ ] #8 OTLP export (`packages/otlp/src/export.js`) emits the **new** attribute names (`gen_ai.provider.name`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`) and includes `gen_ai.operation.name`; optionally emits deprecated names behind a flag for backward compatibility
- [ ] #9 `apps/server/test/demo.js` is rewritten to POST OTLP/HTTP JSON to `/v1/traces` (not the proprietary `/api/spans`) using spec-compliant span names (`{operation.name} {model}`), 32-hex trace IDs, 16-hex span IDs, nanosecond timestamps, and realistic token counts so cost rollups light up
- [ ] #10 Demo includes a nested example: `invoke_workflow {workflow}` → `invoke_agent {agent}` → `execute_tool {tool}` + `chat {model}`, with `gen_ai.conversation.id` and `session.id` set
- [ ] #11 OTLP e2e tests extended to assert ingestion of new attribute names alongside the existing deprecated-name tests
- [ ] #12 README / docs section added explaining the supported GenAI semconv keys (old + new), with a link to the OTel spec and a note about `OTEL_SEMCONV_STABILITY_OPT_IN`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 — Ingest (backwards-compatible)

In `packages/otlp/src/traces.js`:

- `extractTokens(attrs)`: prefer new names, fall back to old.
  ```
  prompt:     gen_ai.usage.input_tokens      ?? gen_ai.usage.prompt_tokens
  completion: gen_ai.usage.output_tokens     ?? gen_ai.usage.completion_tokens
  total:      gen_ai.usage.total_tokens
  cache_create: gen_ai.usage.cache_creation.input_tokens
  cache_read:   gen_ai.usage.cache_read.input_tokens
  reasoning:    gen_ai.usage.reasoning.output_tokens
  ```
- `determineSpanType(attrs)`: add `gen_ai.operation.name` as the highest-priority
  signal (mapping table in the Reference section below). Keep traceloop and
  `gen_ai.system` paths as fallbacks.
- Provider extraction: prefer `gen_ai.provider.name`, fall back to
  `gen_ai.system` (already present).
- `extractIO(attrs, events)`: if `gen_ai.input.messages` / `gen_ai.output.messages`
  are present (any-typed JSON arrays per spec schema), use them; otherwise fall
  back to today's `gen_ai.prompt` / `gen_ai.completion` and event-based extraction.
- Capture request params and response metadata into the `attributes` blob (they
  flow through to the dashboard's span detail view; no schema change required).

### Phase 2 — Export

`packages/otlp/src/export.js` currently emits `gen_ai.system`,
`gen_ai.request.model`, `gen_ai.usage.prompt_tokens`,
`gen_ai.usage.completion_tokens`, `gen_ai.usage.total_tokens`. Rename to:

- `gen_ai.provider.name`
- `gen_ai.operation.name` (NEW — derive from span_type)
- `gen_ai.request.model`
- `gen_ai.response.model`
- `gen_ai.usage.input_tokens`
- `gen_ai.usage.output_tokens`

Optionally keep the deprecated keys behind a `LLMFLOW_OTLP_LEGACY_ATTRS=1` flag
for one release so downstream OTel collectors built against v1.36.0 don't break.

### Phase 3 — Demo rewrite

Replace `apps/server/test/demo.js` (or add `demo-otlp.js` alongside) with a
generator that:

- Generates 32-hex trace IDs and 16-hex span IDs (use the helper already in
  `otlp-e2e.js:29`).
- Posts to `/v1/traces` with the resourceSpans/scopeSpans/spans structure.
- Models a realistic nested workflow per scenario:
  - root (INTERNAL): `invoke_workflow rag-pipeline`, attributes:
    `gen_ai.operation.name=invoke_workflow`, `gen_ai.workflow.name`,
    `gen_ai.conversation.id`, `session.id`
  - child (INTERNAL): `invoke_agent researcher`, attributes:
    `gen_ai.operation.name=invoke_agent`, `gen_ai.agent.name`,
    `gen_ai.agent.id`
    - grandchild (INTERNAL): `execute_tool vector_search`, attributes:
      `gen_ai.operation.name=execute_tool`, `gen_ai.tool.name`,
      `gen_ai.tool.call.id`, `gen_ai.tool.type=function`,
      `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`
    - grandchild (CLIENT): `chat gpt-4o-mini`, attributes:
      `gen_ai.operation.name=chat`, `gen_ai.provider.name=openai`,
      `gen_ai.request.model`, `gen_ai.response.model`,
      `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`,
      `gen_ai.response.finish_reasons=["stop"]`, plus realistic temperature/max_tokens
- Include one scenario per operation: `chat`, `embeddings`, `execute_tool`,
  `invoke_agent`, `invoke_workflow`, `retrieval`.
- Vary models across providers (`openai`, `anthropic`, `gcp.vertex_ai`) so the
  provider rollup lights up.
- One scenario sets `gen_ai.usage.cache_read.input_tokens` to exercise Anthropic
  prompt caching display.
- One scenario sets `gen_ai.usage.reasoning.output_tokens` to exercise
  o1-style reasoning display.

### Phase 4 — Tests + docs

- Extend `otlp-e2e.js` with cases asserting that `gen_ai.usage.input_tokens` and
  `gen_ai.provider.name` are accepted and produce the same DB row shape as the
  legacy keys.
- Add a `docs/genai-semconv.md` (or section in README) covering the keys we
  consume, the precedence rules, and a pointer to the OTel spec.

---

## Reference: full GenAI semconv surface (as of 2026-05-27, status: Development)

### Spec structure

| Section | URL | Purpose |
|---|---|---|
| Index | `/docs/specs/semconv/gen-ai/` | Top-level overview |
| Model Spans | `/docs/specs/semconv/gen-ai/gen-ai-spans/` | Inference, embeddings, retrieval, execute_tool |
| Agent Spans | `/docs/specs/semconv/gen-ai/gen-ai-agent-spans/` | create_agent, invoke_agent, invoke_workflow |
| Events | `/docs/specs/semconv/gen-ai/gen-ai-events/` | Log-based prompt/completion capture |
| Metrics | `/docs/specs/semconv/gen-ai/gen-ai-metrics/` | Token usage + duration histograms |
| Exceptions | `/docs/specs/semconv/gen-ai/gen-ai-exceptions/` | Error reporting |
| Registry | `/docs/specs/semconv/registry/attributes/gen-ai/` | Full attribute list |
| Provider — OpenAI | `/docs/specs/semconv/gen-ai/openai/` | OpenAI-specific extensions |
| Provider — Anthropic | `/docs/specs/semconv/gen-ai/anthropic/` | Anthropic-specific extensions |
| Provider — AWS Bedrock | `/docs/specs/semconv/gen-ai/aws-bedrock/` | Bedrock-specific extensions |
| Provider — Azure AI Inference | `/docs/specs/semconv/gen-ai/azure-ai-inference/` | Azure-specific extensions |
| MCP | `/docs/specs/semconv/gen-ai/mcp/` | Model Context Protocol |
| Examples | `/docs/specs/semconv/gen-ai/non-normative/examples-llm-calls/` | Worked examples |

### Span naming

- Pattern: `{gen_ai.operation.name} {gen_ai.request.model}`
- Retrieval pattern: `{gen_ai.operation.name} {gen_ai.data_source.id}`
- Agent pattern: `{operation.name} {gen_ai.agent.name}` or just `{operation.name}` if name unknown
- Workflow pattern: `invoke_workflow {gen_ai.workflow.name}`
- Tool pattern: `execute_tool {gen_ai.tool.name}`

### Operation names (`gen_ai.operation.name`)

| Value | Span Kind | Notes |
|---|---|---|
| `chat` | CLIENT (or INTERNAL same-process) | Chat completion |
| `text_completion` | CLIENT | Legacy completion API |
| `embeddings` | CLIENT | Vector embedding generation |
| `generate_content` | CLIENT | Multi-modal generation (Gemini-style) |
| `create_agent` | CLIENT | Remote agent creation (OpenAI Assistants) |
| `invoke_agent` | CLIENT or INTERNAL | Remote service vs local framework |
| `invoke_workflow` | INTERNAL | Multi-agent orchestration |
| `execute_tool` | INTERNAL | Tool/function invocation |
| `retrieval` | CLIENT | Vector DB / data source query |

### Required attributes (inference spans)

- `gen_ai.operation.name` (string) — required
- `gen_ai.provider.name` (string) — required
- `error.type` — conditionally required on error

### Conditionally required

- `gen_ai.request.model` — if available
- `gen_ai.conversation.id` — when framework manages it
- `gen_ai.output.type` — when output format is constrained
- `server.address`, `server.port` — when applicable

### Recommended request attributes

| Key | Type | Notes |
|---|---|---|
| `gen_ai.request.temperature` | double | |
| `gen_ai.request.top_p` | double | |
| `gen_ai.request.top_k` | double | |
| `gen_ai.request.max_tokens` | int | |
| `gen_ai.request.frequency_penalty` | double | |
| `gen_ai.request.presence_penalty` | double | |
| `gen_ai.request.stop_sequences` | string[] | |
| `gen_ai.request.seed` | int | |
| `gen_ai.request.choice.count` | int | Number of candidate completions |
| `gen_ai.request.stream` | boolean | Streaming mode |
| `gen_ai.request.encoding_formats` | string[] | Embeddings-specific |
| `gen_ai.embeddings.dimension.count` | int | Embeddings output dim |
| `gen_ai.data_source.id` | string | Retrieval data source |

### Recommended response attributes

| Key | Type | Notes |
|---|---|---|
| `gen_ai.response.id` | string | `chatcmpl-123` |
| `gen_ai.response.model` | string | Actual model used (may differ from request.model) |
| `gen_ai.response.finish_reasons` | string[] | `["stop"]`, `["length"]`, etc. |
| `gen_ai.response.time_to_first_chunk` | double | Seconds; streaming only |

### Recommended usage attributes (NEW NAMES)

| Key | Type | Notes |
|---|---|---|
| `gen_ai.usage.input_tokens` | int | **Replaces `gen_ai.usage.prompt_tokens`** |
| `gen_ai.usage.output_tokens` | int | **Replaces `gen_ai.usage.completion_tokens`** |
| `gen_ai.usage.cache_creation.input_tokens` | int | Tokens written to provider cache (Anthropic) |
| `gen_ai.usage.cache_read.input_tokens` | int | Tokens read from provider cache |
| `gen_ai.usage.reasoning.output_tokens` | int | Reasoning/chain-of-thought tokens (o1-style) |

### Agent attributes

| Key | Type | Notes |
|---|---|---|
| `gen_ai.agent.id` | string | e.g. `asst_5j66UpCpwteGg4YSxUnt7lPY` |
| `gen_ai.agent.name` | string | Human-readable name |
| `gen_ai.agent.description` | string | Free-form purpose |
| `gen_ai.agent.version` | string | |
| `gen_ai.workflow.name` | string | e.g. `multi_agent_rag` |
| `gen_ai.conversation.id` | string | Session/thread correlation |

### Tool attributes

| Key | Type | Notes |
|---|---|---|
| `gen_ai.tool.name` | string | |
| `gen_ai.tool.type` | string | e.g. `function` |
| `gen_ai.tool.description` | string | |
| `gen_ai.tool.call.id` | string | |
| `gen_ai.tool.call.arguments` | any | JSON object — **opt-in** (sensitive) |
| `gen_ai.tool.call.result` | any | JSON — **opt-in** |
| `gen_ai.tool.definitions` | any | Available tools — **opt-in** |

### Opt-in (sensitive) attributes

These require explicit user opt-in due to size/PII:

- `gen_ai.system_instructions` — system message as structured array
- `gen_ai.input.messages` — chat history (defined JSON schema, with role/parts)
- `gen_ai.output.messages` — model responses, one per choice/candidate
- `gen_ai.tool.definitions`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`
- `gen_ai.retrieval.documents`, `gen_ai.retrieval.query.text`

Message schema (role + parts):

```jsonc
{
  "role": "user" | "assistant" | "system" | "tool",
  "parts": [
    { "type": "text", "content": "..." },
    { "type": "tool_call", "id": "call_...", "name": "...", "arguments": {...} },
    { "type": "tool_call_response", "id": "call_...", "response": {...} }
  ]
}
```

### Output type values

`gen_ai.output.type`: `text`, `json`, `image`, `speech`.

### Provider names (`gen_ai.provider.name`)

`anthropic`, `aws.bedrock`, `azure.ai.openai`, `cohere`, `deepseek`,
`gcp.gemini`, `gcp.gen_ai`, `gcp.vertex_ai`, `groq`, `ibm.watsonx.ai`,
`mistral_ai`, `openai`, `perplexity`, `x_ai`.

### Events / logs

Two event types defined:

1. `gen_ai.client.inference.operation.details` — opt-in body carrying request
   params, chat history, response details (effectively the structured form of
   what used to be `gen_ai.prompt` / `gen_ai.completion`).
2. `gen_ai.evaluation.result` — quality assessment of GenAI output. Requires
   `gen_ai.evaluation.name`; optional `score.label`, `score.value`, `explanation`.

### Metrics

| Metric | Type | Unit | Required attrs | Buckets |
|---|---|---|---|---|
| `gen_ai.client.operation.duration` | Histogram | `s` | `operation.name`, `provider.name`, `error.type` (on error) | `[0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56, 5.12, 10.24, 20.48, 40.96, 81.92]` |
| `gen_ai.client.token.usage` | Histogram | `{token}` | `operation.name`, `provider.name`, `token.type` | `[1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864]` |
| `gen_ai.client.operation.time_to_first_chunk` | Histogram | `s` | `operation.name`, `provider.name` | same as operation.duration |
| `gen_ai.client.operation.time_per_output_chunk` | Histogram | `s` | `operation.name`, `provider.name` | same as operation.duration |
| `gen_ai.server.request.duration` | Histogram | `s` | `operation.name`, `provider.name`, `error.type` (on error) | same as operation.duration |
| `gen_ai.server.time_per_output_token` | Histogram | `s` | `operation.name`, `provider.name` | `[0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.75, 1.0, 2.5]` |
| `gen_ai.server.time_to_first_token` | Histogram | `s` | `operation.name`, `provider.name` | `[0.001, 0.005, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0]` |

`gen_ai.token.type` values: `input`, `output`.

### Deprecated keys (still seen in the wild — keep accepting on ingest)

| Deprecated | Replacement |
|---|---|
| `gen_ai.system` | `gen_ai.provider.name` |
| `gen_ai.usage.prompt_tokens` | `gen_ai.usage.input_tokens` |
| `gen_ai.usage.completion_tokens` | `gen_ai.usage.output_tokens` |
| `gen_ai.prompt` | Event API (`gen_ai.input.messages`) |
| `gen_ai.completion` | Event API (`gen_ai.output.messages`) |
| `gen_ai.openai.request.response_format` | `gen_ai.output.type` |
| `gen_ai.openai.request.seed` | `gen_ai.request.seed` |
| `gen_ai.openai.request.service_tier` | `openai.request.service_tier` |
| `gen_ai.openai.response.service_tier` | `openai.response.service_tier` |
| `gen_ai.openai.response.system_fingerprint` | `openai.response.system_fingerprint` |

### Stability migration

The spec recommends the `OTEL_SEMCONV_STABILITY_OPT_IN` env var with value
`gen_ai_latest_experimental` to adopt the new names while keeping legacy by
default. LLMFlow's ingest should be liberal (accept both); the export can
choose its emission style via a similar flag (`LLMFLOW_OTLP_LEGACY_ATTRS=1`).

### Span-type mapping table (for `determineSpanType`)

| `gen_ai.operation.name` | LLMFlow `span_type` |
|---|---|
| `chat`, `text_completion`, `generate_content` | `llm` |
| `embeddings` | `embedding` |
| `execute_tool` | `tool` |
| `create_agent`, `invoke_agent` | `agent` |
| `invoke_workflow` | `chain` (or new `workflow`) |
| `retrieval` | `retrieval` |
<!-- SECTION:PLAN:END -->
