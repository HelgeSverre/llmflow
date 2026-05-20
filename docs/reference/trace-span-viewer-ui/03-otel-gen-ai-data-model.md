# OTel gen_ai Semantic Conventions — State of the Art

> Snapshot date: 2026-05-20. The official GenAI spec is still marked **Development** (not stable). Treat attribute names as a moving target; the migration sections below document the migration knobs every instrumentation library has had to ship.

## Executive Summary

The OpenTelemetry Generative AI semantic conventions are now hosted in a dedicated repo — [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai) — split out of the main `semantic-conventions` repo in 2026. Every gen_ai attribute, metric, event and span shape is still marked **Development** (a status one notch below `experimental` in the OTel taxonomy, and two notches below `stable`). The only attributes used on these spans that are actually stable are the shared `server.address`, `server.port`, and `error.type`. The whole namespace is therefore still legally allowed to change — and it has, twice, in the last 18 months: once around v1.30 (introduced operation.name + system → provider.name renaming), and again between v1.36 and v1.38 (collapsed per-role events into a single inference event, added `gen_ai.input.messages` / `gen_ai.output.messages` as structured attributes, deprecated `gen_ai.prompt` / `gen_ai.completion`). To absorb that churn, the spec defines a single env var — `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` — that every conforming instrumentation library MUST honour. If it isn't set, libraries keep emitting whatever version they were emitting before. That means in practice, **a real-world OTel ingester sees v1.30, v1.36, and v1.38 attribute shapes interleaved on the same wire**.

Outside the official spec, three sibling conventions persist. **OpenLLMetry** (Traceloop) predates the OTel spec by ~2 years, owns the `traceloop.*` namespace for workflow/agent/task structure, and has a sprawling parallel `llm.*` namespace that is now mostly deprecated in favour of `gen_ai.*`. It still ships unique attributes for Pinecone/Chroma/Weaviate/Qdrant/Milvus that the official spec doesn't define. **OpenInference** (Arize/Phoenix) uses an entirely different namespace — `llm.*`, `tool.*`, `embedding.*`, `retrieval.*`, `openinference.span.kind` — and has the strongest model for first-class span kinds (LLM, CHAIN, AGENT, TOOL, RETRIEVER, RERANKER, EMBEDDING, GUARDRAIL, EVALUATOR, PROMPT). It is the only convention that explicitly defines a **cost attribute** (`llm.cost.prompt|completion|total`). **Vercel AI SDK** dual-emits: an `ai.*` namespace carrying SDK-specific structure (rich content, streaming metrics like `ai.response.msToFirstChunk`, function IDs) plus a parallel `gen_ai.*` set targeting whatever OTel version the SDK was built against.

The "convention war" has a winner on paper (OTel gen_ai) but not in deployed code. Mastra is the cleanest example of a modern framework that emits OTel v1.38 gen_ai directly; LangChain/LangSmith accepts everything (`gen_ai.*`, `langsmith.*`, `llm.*`, `ai.*`) and normalises at ingest via its `langsmith-collector-proxy`; Traceloop emits a hybrid of `gen_ai.*` + `traceloop.*` + provider-specific. **An ingester that wants to support real traffic in 2026 must therefore tolerate four dialects simultaneously and resolve the same logical field from up to ~6 candidate attribute names.**

For llmflow specifically, the spec landscape has three concrete implications: (1) the existing token extraction logic in `otlp.js` covers the v1.30-1.36 shape but misses cache tokens, reasoning tokens, OpenInference's `llm.token_count.*` and OpenLLMetry's legacy aliases; (2) the prompt/completion extraction is built around the deprecated `gen_ai.prompt` / `gen_ai.completion` pair and ignores the new v1.38 `gen_ai.input.messages` / `gen_ai.output.messages` / `gen_ai.system_instructions` structured attributes plus the consolidated `gen_ai.client.inference.operation.details` event; (3) the span-type detection conflates "framework span kind" (workflow/task/agent/tool from OpenLLMetry & OpenInference) with "operation type" (chat/embeddings/retrieval/execute_tool/invoke_agent from OTel gen_ai) — they should be two columns, not one.

## The convention landscape

### OpenTelemetry official (`gen_ai.*`)

- **Status:** Development (= pre-experimental). Last spec version referenced in the wild: **v1.38.0**. Source-of-truth: [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai) — files of interest: `docs/gen-ai/gen-ai-spans.md`, `docs/gen-ai/gen-ai-agent-spans.md`, `docs/gen-ai/gen-ai-events.md`, `docs/gen-ai/gen-ai-metrics.md`. Schema URL is `https://opentelemetry.io/schemas/gen-ai/1.42.0`.
- **Defines:** five core span "operation classes" via a single discriminator `gen_ai.operation.name` — `chat`, `text_completion`, `generate_content`, `embeddings`, `retrieval`, `execute_tool`, `invoke_agent`, `create_agent`, `invoke_workflow`, `plan`, plus a memory family (`create_memory_store`, `create_memory`, `update_memory`, `upsert_memory`, `search_memory`, `delete_memory`, `delete_memory_store`). Names span: `{operation.name} {request.model}` for inference/embeddings, `{operation.name} {data_source.id}` for retrieval, `execute_tool {tool.name}` for tool execution, `invoke_agent {agent.name}` for agent invocation, `create_agent {agent.name}` for agent creation, bare `{operation.name}` for memory.
- **Provider discriminator:** `gen_ai.provider.name` (introduced ~v1.30, replaces older `gen_ai.system`). Well-known values include `openai`, `anthropic`, `aws.bedrock`, `azure.ai.inference`, `azure.ai.openai`, `cohere`, `deepseek`, `gcp.gemini`, `gcp.gen_ai`, `gcp.vertex_ai`, `groq`, `ibm.watsonx.ai`, `mistral_ai`, `perplexity`, `x_ai`. Custom values are allowed.
- **Token shape:** `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` (the v1.30+ shape). Older `gen_ai.usage.prompt_tokens` / `gen_ai.usage.completion_tokens` are still emitted by every pre-v1.30 instrumentation in the wild. Cache-aware additions: `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.cache_creation.input_tokens` — note these MUST already be included in `input_tokens` (i.e. they are sub-classifications, not separate totals). Reasoning models add `gen_ai.usage.reasoning.output_tokens` — also a sub-classification of `output_tokens`.
- **Does NOT define:** total tokens (computed by client), cost (no attribute), session id (`gen_ai.conversation.id` is the closest, but it is a logical thread id, not a billing/auth session), `is_streaming` boolean (replaced by `gen_ai.request.stream`), user id (no equivalent), trace-level tags.
- **Content storage:** as of v1.38 the canonical shape is three **structured attributes** on the span (or equivalently in the `gen_ai.client.inference.operation.details` event): `gen_ai.system_instructions`, `gen_ai.input.messages`, `gen_ai.output.messages`. Each follows a JSON Schema defined in the repo (`gen-ai-input-messages.json`, `gen-ai-output-messages.json`, `gen-ai-system-instructions.json`). Format is `[{ role, parts: [{ type: "text" | "tool_call" | "tool_call_response" | "image" | ..., content | name | arguments | result | id }] }]`. The spec acknowledges that OTLP attributes don't yet officially support "any" types on spans and explicitly permits serialising these as JSON strings on spans until [OTEP 4485](https://github.com/open-telemetry/opentelemetry-specification/blob/main/oteps/4485-extending-attributes-to-support-complex-values.md) lands.
- **Streaming:** `gen_ai.request.stream` boolean. `gen_ai.response.time_to_first_chunk` (seconds, double) as a span attribute. No span events are required; libraries MAY add them but the spec doesn't standardise event names.
- **Errors:** `error.type` (low-cardinality, e.g. `timeout`, `500`, `java.net.UnknownHostException`, or `_OTHER`) — this attribute is **Stable** (one of the few). `gen_ai.response.finish_reasons` array (per-choice; values like `stop`, `length`, `tool_calls`). Span status SHOULD follow the standard OTel `recording-errors.md` rules.
- **Multi-turn:** `gen_ai.conversation.id` is the only standardised identifier and is conditional-required when "available". There is no `session.id` in the gen_ai namespace (OpenInference defines one — see below).
- **Multimodal:** message parts include `type: "image"` and `type: "audio"`, plus speech and json output via `gen_ai.output.type` (text|json|image|speech).

### OpenLLMetry / Traceloop (`traceloop.*` + `llm.*` + `gen_ai.*`)

- **Why it exists:** Traceloop shipped OpenLLMetry in early 2024, ~2 years before the OTel GenAI WG ratified anything. Their `traceloop.*` namespace defines the workflow/agent/task/tool span-kind hierarchy that the OTel spec is only now catching up to via `invoke_workflow` / `invoke_agent` / `execute_tool`.
- **Span-kind discriminator:** `traceloop.span.kind` ∈ {`workflow`, `task`, `agent`, `tool`, `unknown`}. Entity naming: `traceloop.entity.name`, `traceloop.entity.path`, `traceloop.entity.version`, plus `traceloop.workflow.name`. Input/output bodies: `traceloop.entity.input`, `traceloop.entity.output`.
- **Prompt management:** OpenLLMetry is the only convention with first-class prompt template attributes — `traceloop.prompt.key`, `traceloop.prompt.version`, `traceloop.prompt.template`, `traceloop.prompt.template_variables`, `traceloop.prompt.managed`.
- **Association properties:** `traceloop.association.properties` — a free-form object that effectively works as Traceloop's `session.id` / `user.id` / arbitrary tags carrier.
- **Vector DB coverage:** OpenLLMetry defines provider-specific attribute sets for Pinecone (`pinecone.usage.read_units`, `pinecone.query.top_k`, …), Chroma (~25 attributes), Milvus (~31 attributes), Qdrant, Marqo. OTel gen_ai has nothing equivalent.
- **Legacy `llm.*` namespace:** maintained for backward compatibility but the underlying values now point at `gen_ai.*` strings. Example: `SpanAttributes.LLM_REQUEST_MODEL = "gen_ai.request.model"`, `SpanAttributes.LLM_SYSTEM = "gen_ai.system"`. A few `llm.*` constants still resolve to actual `llm.*` keys (e.g. `llm.frequency_penalty`, `llm.presence_penalty`, `llm.top_k`, `llm.request.type`, `llm.watsonx.*`) — these never got promoted.
- **Deprecated content storage:** `gen_ai.prompt` and `gen_ai.completion` (whole-blob JSON strings or numbered enumerations like `gen_ai.prompt.{i}.role` / `gen_ai.prompt.{i}.content`). Traceloop issue [#3515](https://github.com/traceloop/openllmetry/issues/3515) confirms these are marked deprecated as of v1.38 of the OTel spec. They are however still emitted by every OpenLLMetry-instrumented app in the field.
- **Migration path:** OpenLLMetry now imports OTel's `gen_ai.*` constants directly. New code emits both for compatibility; consumers should prefer `gen_ai.*` and fall back to `llm.*` only when the canonical attribute is missing.

### OpenInference (Arize / Phoenix)

- **Why it exists:** Arize built Phoenix and the OpenInference spec to capture the full LLM-app graph (chains, retrievers, rerankers, guardrails, evaluators), which the early `gen_ai.*` spec didn't model. They prioritised UI-driven concepts: a flat list of typed messages, per-document scores/IDs, prompt templates, MIME types for input/output payloads.
- **Span kind:** `openinference.span.kind` ∈ {`LLM`, `CHAIN`, `AGENT`, `TOOL`, `RETRIEVER`, `EMBEDDING`, `RERANKER`, `GUARDRAIL`, `EVALUATOR`, `PROMPT`, `UNKNOWN`}. This is **richer than OTel's `operation.name`**: it separates a `CHAIN` (orchestration) from an `AGENT` (decision-making) and treats `RERANKER` and `GUARDRAIL` as first-class types.
- **Content storage:** numbered enumerations on the span — `llm.input_messages` is conceptually a list but is recorded via `llm.input_messages.{i}.message.role`, `llm.input_messages.{i}.message.content`, `llm.input_messages.{i}.message.tool_calls.{j}.tool_call.function.name`, etc. Similarly `llm.output_messages.{i}.message.content` and `llm.prompts` / `llm.choices`. Each tool call gets its own nested attribute path. Parts (text/image/audio) live under `message_content.type`, `message_content.text`, `message_content.image`. Retrieved docs live under `retrieval.documents.{i}.document.id|score|content|metadata`.
- **Tokens:** `llm.token_count.prompt`, `llm.token_count.completion`, `llm.token_count.total`. **Cost (this is unique to OpenInference):** `llm.cost.prompt`, `llm.cost.completion`, `llm.cost.total`. No other convention defines cost.
- **Provider/model:** `llm.model_name`, `llm.provider`, `llm.system`, `llm.invocation_parameters` (JSON string of full request params).
- **Session/user:** `session.id`, `user.id`, plus `tag.tags`, `metadata`. OpenInference is the only convention with a clean `session.id` attribute that doesn't conflate "conversation thread" with "billing session".
- **Agent/graph:** `agent.name`, `graph.node.id`, `graph.node.name`, `graph.node.parent_id`. Captures cross-node parent relationships beyond simple parent-span links.
- **Where it disagrees with OTel:** flat numbered keys vs. structured "any" attributes; cost as first-class column; richer span-kind taxonomy; MIME-typed I/O payloads (`input.mime_type` ∈ `text/plain` | `application/json`).

### Vendor-specific (Vercel AI SDK, Mastra, LangChain)

**Vercel AI SDK** (`experimental_telemetry: true`):

- Emits `ai.*` (SDK-specific, rich) **and** `gen_ai.*` (OTel-compliant, smaller subset) on the same span.
- Span hierarchy: `ai.generateText` (root) → `ai.generateText.doGenerate` (per provider call) → `ai.toolCall` (per tool execution). Streaming variants: `ai.streamText` / `ai.streamText.doStream`. Embedding: `ai.embed` / `ai.embed.doEmbed`, `ai.embedMany`.
- `ai.*` request side: `ai.operationId`, `ai.model.id`, `ai.model.provider`, `ai.prompt`, `ai.prompt.messages`, `ai.prompt.tools`, `ai.prompt.toolChoice`, `ai.settings.maxOutputTokens`, `ai.settings.maxRetries`, `ai.request.headers.*`, `ai.telemetry.functionId`, `ai.telemetry.metadata.*`.
- `ai.*` response side: `ai.response.text`, `ai.response.toolCalls`, `ai.response.finishReason`, `ai.response.model`, `ai.response.id`, `ai.response.timestamp`, `ai.response.providerMetadata`, `ai.usage.promptTokens`, `ai.usage.completionTokens`.
- `ai.*` streaming: `ai.response.msToFirstChunk`, `ai.response.msToFinish`, `ai.response.avgCompletionTokensPerSecond`, plus span events `ai.stream.firstChunk` and `ai.stream.finish`.
- `ai.*` tool: `ai.toolCall.name`, `ai.toolCall.id`, `ai.toolCall.args`, `ai.toolCall.result`.
- Parallel `gen_ai.*`: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.request.temperature|max_tokens|frequency_penalty|presence_penalty|top_k|top_p|stop_sequences`, `gen_ai.response.finish_reasons|model|id`, `gen_ai.usage.input_tokens|output_tokens`.
- **Embedding spans do NOT emit `gen_ai.*`** — Vercel chose to keep embeddings off the GenAI convention. That's a documented and deliberate gap.

**Mastra** (`@mastra/core` + `observability/otel-exporter`):

- Cleanest modern implementation. Targets OTel GenAI **v1.38.0** explicitly (file header in `observability/otel-exporter/src/gen-ai-semantics.ts`).
- Imports constants from `@opentelemetry/semantic-conventions/incubating`: `ATTR_GEN_AI_PROVIDER_NAME`, `ATTR_GEN_AI_REQUEST_MODEL`, `ATTR_GEN_AI_RESPONSE_MODEL`, `ATTR_GEN_AI_REQUEST_MAX_TOKENS`, …, `ATTR_GEN_AI_INPUT_MESSAGES`, `ATTR_GEN_AI_OUTPUT_MESSAGES`, `ATTR_GEN_AI_USAGE_INPUT_TOKENS`, `ATTR_GEN_AI_USAGE_OUTPUT_TOKENS`, `ATTR_GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS`, `ATTR_GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS`, `ATTR_GEN_AI_AGENT_ID|NAME`, `ATTR_GEN_AI_TOOL_NAME|DESCRIPTION`, `ATTR_GEN_AI_OPERATION_NAME`, `ATTR_GEN_AI_RESPONSE_FINISH_REASONS|ID`, `ATTR_GEN_AI_CONVERSATION_ID`, `ATTR_GEN_AI_SYSTEM_INSTRUCTIONS`, `ATTR_SERVER_ADDRESS|PORT`.
- Adds non-standard but useful extensions in the same `gen_ai.*` namespace: `gen_ai.usage.reasoning_tokens`, `gen_ai.usage.audio_input_tokens`, `gen_ai.usage.audio_output_tokens`.
- Span kinds map cleanly to OTel `operation.name` — Mastra's internal `SpanType` ∈ {AGENT_RUN, MODEL_GENERATION, TOOL_CALL, MCP_TOOL_CALL} → `invoke_agent`, `chat`, `execute_tool`, `execute_tool`.

**LangChain / LangSmith** (`langsmith-collector-proxy` + `LangSmithOTLPTraceExporter`):

- LangSmith accepts traces via an OTLP endpoint at `https://api.smith.langchain.com/otel/v1/traces`. Internally, the collector-proxy filters spans by attribute prefix — keeping anything matching `gen_ai.*`, `langsmith.*`, `llm.*`, `ai.*` and dropping the rest unless `GENERIC_OTEL_ENABLED=true`.
- LangSmith-native namespace: `langsmith.trace.name`, `langsmith.span.kind` (llm, chain, tool, retriever, embedding, prompt, parser), `langsmith.trace.session_id`, `langsmith.trace.session_name`, `langsmith.span.tags`, `langsmith.metadata.{key}`.
- Primary supported convention: **OpenLLMetry**. The collector-proxy translates `gen_ai.*` semantics into LangSmith's internal model, but the docs explicitly say "data must be sent with the OpenLLMetry semantic convention". So in practice LangSmith is OpenLLMetry-first, OTel gen_ai-second.

## Attribute reference (cross-walked)

> Stability marker: ![D] = OTel "Development" (pre-experimental). Everything in `gen_ai.*` is currently ![D]. `error.type`, `server.address`, `server.port` are the only Stable attributes used by gen_ai spans.

### Span identity / operation classification

| Concept              | OTel official                                                                                                           | OpenLLMetry                                                                                            | OpenInference                                                                                            | Vercel AI SDK                                                        | LangSmith                                                                | Notes                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| Operation type       | `gen_ai.operation.name` (enum: chat/embeddings/retrieval/execute_tool/invoke_agent/create_agent/invoke_workflow/plan/…) | `traceloop.span.kind` (workflow/task/agent/tool) — orthogonal: this is _framework_ role, not operation | `openinference.span.kind` (LLM/CHAIN/AGENT/TOOL/RETRIEVER/EMBEDDING/RERANKER/GUARDRAIL/EVALUATOR/PROMPT) | `ai.operationId` (e.g. `ai.generateText`, `ai.toolCall`, `ai.embed`) | `langsmith.span.kind` (llm/chain/tool/retriever/embedding/prompt/parser) | OTel and OpenInference _both_ play this role — the former encodes "API operation", the latter "logical node type". They are not equivalent. |
| Provider             | `gen_ai.provider.name` (post-1.30) ![D]                                                                                 | `gen_ai.system` (pre-1.30, still emitted)                                                              | `llm.provider`, `llm.system`                                                                             | `gen_ai.system` + `ai.model.provider`                                | Inferred from sub-attrs                                                  | OTel renamed `system` → `provider.name`. Both still show up.                                                                                |
| Model (request)      | `gen_ai.request.model` ![D]                                                                                             | `gen_ai.request.model`                                                                                 | `llm.model_name`, `embedding.model_name`                                                                 | `gen_ai.request.model`, `ai.model.id`                                | `gen_ai.request.model`                                                   | All converge on `gen_ai.request.model`.                                                                                                     |
| Model (response)     | `gen_ai.response.model` ![D]                                                                                            | `gen_ai.response.model`                                                                                | (same as request)                                                                                        | `gen_ai.response.model`, `ai.response.model`                         | `gen_ai.response.model`                                                  | Useful for capturing fine-tuned vs base model resolution.                                                                                   |
| Response id          | `gen_ai.response.id` ![D]                                                                                               | `gen_ai.response.id`                                                                                   | (none standard)                                                                                          | `gen_ai.response.id`, `ai.response.id`                               | `gen_ai.response.id`                                                     | Provider's chat-completion id (e.g. `chatcmpl-123`).                                                                                        |
| Conversation/session | `gen_ai.conversation.id` ![D]                                                                                           | `traceloop.association.properties.*`                                                                   | `session.id`                                                                                             | `ai.telemetry.metadata.*`                                            | `langsmith.trace.session_id`                                             | OpenInference is the only one with a clean `session.id`.                                                                                    |
| Agent                | `gen_ai.agent.id                                                                                                        | name                                                                                                   | description                                                                                              | version` ![D]                                                        | `traceloop.entity.name` + kind=`agent`                                   | `agent.name`                                                                                                                                | `ai.telemetry.functionId` | `langsmith.span.kind=chain` | OTel and OpenInference both support agent IDs; Traceloop ties this to its entity model. |
| User                 | (none)                                                                                                                  | `gen_ai.user` (legacy `llm.user`)                                                                      | `user.id`                                                                                                | (none)                                                               | (none)                                                                   | OTel has no user attribute. Privacy-driven choice.                                                                                          |

### Token usage

| Concept                  | OTel official                                   | OpenLLMetry                                                       | OpenInference                | Vercel AI SDK                                             | Notes                                                                                           |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Input tokens             | `gen_ai.usage.input_tokens` ![D]                | `gen_ai.usage.prompt_tokens` (legacy)                             | `llm.token_count.prompt`     | `gen_ai.usage.input_tokens`, `ai.usage.promptTokens`      | The big rename ~v1.30. **Both shapes still live in the wild.**                                  |
| Output tokens            | `gen_ai.usage.output_tokens` ![D]               | `gen_ai.usage.completion_tokens` (legacy)                         | `llm.token_count.completion` | `gen_ai.usage.output_tokens`, `ai.usage.completionTokens` | Same story.                                                                                     |
| Total tokens             | (derived; not defined)                          | `gen_ai.usage.total_tokens` (legacy `llm.usage.total_tokens`)     | `llm.token_count.total`      | (not emitted)                                             | OTel deliberately doesn't define a total — sum input+output.                                    |
| Cache read               | `gen_ai.usage.cache_read.input_tokens` ![D]     | same (mirrors OTel)                                               | (none)                       | (not emitted)                                             | Spec says: SHOULD be included in `input_tokens`.                                                |
| Cache creation           | `gen_ai.usage.cache_creation.input_tokens` ![D] | same                                                              | (none)                       | (not emitted)                                             | Same.                                                                                           |
| Reasoning tokens         | `gen_ai.usage.reasoning.output_tokens` ![D]     | `gen_ai.usage.reasoning_tokens` (legacy, slightly different name) | (none)                       | (not emitted)                                             | Note name divergence: OTel uses `reasoning.output_tokens`, OpenLLMetry uses `reasoning_tokens`. |
| Audio in/out             | (not defined)                                   | (not defined)                                                     | (none)                       | (not emitted)                                             | Mastra invented `gen_ai.usage.audio_input_tokens` / `audio_output_tokens` ad-hoc.               |
| Token type (metric only) | `gen_ai.token.type` ∈ {input, output} ![D]      | `gen_ai.usage.token_type`                                         | (n/a, separate keys)         | (n/a)                                                     | Only on the `gen_ai.client.token.usage` metric, not on spans.                                   |

### Cost

Only **OpenInference** defines cost:

| Concept         | OpenInference         | Everywhere else     |
| --------------- | --------------------- | ------------------- |
| Prompt cost     | `llm.cost.prompt`     | derived by ingester |
| Completion cost | `llm.cost.completion` | derived by ingester |
| Total cost      | `llm.cost.total`      | derived by ingester |

OTel gen_ai has discussed but **not defined** a cost attribute. Rationale: cost is a function of provider pricing tables that change frequently and shouldn't be baked into observability.

### Prompts / completions (content)

The convention war is most active here. Five distinct shapes exist; an ingester should accept all of them.

| Convention                            | Shape                                                                                                                                        | Storage                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **OTel v1.38+ (current)**             | Structured: `gen_ai.input.messages = [{role, parts:[{type, content                                                                           | name                                                                                                     | arguments                              | result                                                                                                        | id}]}]`, `gen_ai.output.messages = [{role, parts:[…], finish_reason}]`, `gen_ai.system_instructions = [{type, content}]`, `gen_ai.tool.definitions = [{type, name, description, parameters}]` | "any" attribute on span (JSON-string fallback) OR event `gen_ai.client.inference.operation.details` (structured) |
| **OTel v1.30–1.36 (legacy events)**   | Per-role events: `gen_ai.system.message`, `gen_ai.user.message`, `gen_ai.assistant.message`, `gen_ai.tool.message`, `gen_ai.choice`          | Span events with `gen_ai.message.role`, `gen_ai.message.content`, `gen_ai.message.tool_calls` attributes |
| **OpenLLMetry (deprecated but live)** | `gen_ai.prompt` (whole JSON blob) + `gen_ai.completion` (whole JSON blob) OR numbered `gen_ai.prompt.{i}.role` / `gen_ai.prompt.{i}.content` | Span attributes only                                                                                     |
| **OpenInference**                     | Numbered: `llm.input_messages.{i}.message.role                                                                                               | content                                                                                                  | tool_calls.{j}.tool_call.function.name | arguments`, `llm.output_messages.{i}.…`, `input.value`, `output.value`, `input.mime_type`, `output.mime_type` | Span attributes only                                                                                                                                                                          |
| **Vercel AI SDK**                     | `ai.prompt` (string), `ai.prompt.messages` (JSON), `ai.response.text`, `ai.response.toolCalls`                                               | Span attributes only                                                                                     |

The **content-storage problem** in one sentence: there is no agreement on whether prompts live in attributes (and if so, structured or flattened or stringified) or in events (and if so, one per message or one consolidated event).

System instructions specifically — only OTel v1.38 isolates these via `gen_ai.system_instructions`. Everyone else just sticks them into the messages list as `role=system`.

### Tool calls

Two questions: how is the _tool definition_ recorded, and how is the _tool invocation/result_ recorded?

| Concept                        | OTel official                                                                                                                                                                                                                                                              | OpenLLMetry                                          | OpenInference                                                                                         | Vercel AI SDK                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Tool definitions (at request)  | `gen_ai.tool.definitions = [{type, name, description, parameters}]` ![D] Opt-In                                                                                                                                                                                            | `llm.request.functions` (legacy)                     | `llm.tools`, `tool.json_schema`                                                                       | `ai.prompt.tools`                                                                                                                                                          |
| Tool call in assistant message | Embedded in `gen_ai.input.messages[i].parts[j]` with `type="tool_call"`, `id`, `name`, `arguments`                                                                                                                                                                         | Embedded in numbered enumeration                     | `llm.output_messages.{i}.message.tool_calls.{j}.tool_call.function.{name,arguments}` + `tool_call.id` | `ai.response.toolCalls`                                                                                                                                                    |
| Tool result in tool message    | Embedded as `type="tool_call_response"`, `id`, `result`                                                                                                                                                                                                                    | Numbered                                             | `llm.input_messages.{i}.message.role="tool"` + `message.content`                                      | embedded in `ai.prompt.messages`                                                                                                                                           |
| Tool execution **span**        | Dedicated `execute_tool {tool.name}` span (INTERNAL kind). Attrs: `gen_ai.tool.name` (Req), `gen_ai.tool.call.id`, `gen_ai.tool.description`, `gen_ai.tool.type` (function/extension/datastore), `gen_ai.tool.call.arguments` (Opt-In), `gen_ai.tool.call.result` (Opt-In) | `traceloop.span.kind=tool` + `traceloop.entity.input | output`                                                                                               | `openinference.span.kind=TOOL` + `tool.name`, `tool.description`, `tool.parameters`, `tool.id` + `tool_call.id`, `tool_call.function.name`, `tool_call.function.arguments` | `ai.toolCall` span with `ai.toolCall.name`, `ai.toolCall.id`, `ai.toolCall.args`, `ai.toolCall.result` |

**Three patterns coexist:** (1) tool call as a _part_ inside a structured message (OTel v1.38, Vercel), (2) tool call as numbered attributes on the parent span (OpenInference, OpenLLMetry legacy), (3) tool execution as a separate child span (OTel `execute_tool`, Traceloop, OpenInference's TOOL kind, Vercel `ai.toolCall`). Production traces use all three at once.

### Streaming

| Concept               | OTel official                                                | OpenLLMetry                                                               | OpenInference       | Vercel AI SDK                                                                  |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| Is streaming?         | `gen_ai.request.stream` (bool) ![D]                          | `gen_ai.is_streaming` (legacy `llm.is_streaming`)                         | (none)              | (implicit in span name `ai.streamText`)                                        |
| Time to first chunk   | `gen_ai.response.time_to_first_chunk` (seconds, double) ![D] | (none)                                                                    | (none)              | `ai.response.msToFirstChunk` (milliseconds, span event `ai.stream.firstChunk`) |
| Time per output chunk | (metric: `gen_ai.client.operation.time_per_output_chunk`)    | (none)                                                                    | (none)              | `ai.response.avgCompletionTokensPerSecond`                                     |
| Total stream duration | (use span duration)                                          | (use span duration)                                                       | (use span duration) | `ai.response.msToFinish` (event `ai.stream.finish`)                            |
| Per-chunk content     | (none — would be enormous)                                   | `gen_ai.content.completion.chunk` (legacy `llm.content.completion.chunk`) | (none)              | (none)                                                                         |

Span model: everyone uses a single span with start = request issued and end = stream closed. Span events are not standardised; Vercel is the only one to put streaming milestones in events.

### Errors

| Concept          | OTel official                                                                                | OpenLLMetry                                                                                          | OpenInference                    | Vercel AI SDK                                                |
| ---------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| Error class      | `error.type` (Stable)                                                                        | `error.type`                                                                                         | (uses OTel `exception.*` events) | `error.type`                                                 |
| Error message    | (no gen_ai-specific; use OTel `exception.message` event or `error.message`)                  | `error.message`                                                                                      | `exception.message`              | `error.message`                                              |
| Span status code | OTel standard: 0=UNSET, 1=OK, 2=ERROR                                                        | same                                                                                                 | same                             | same                                                         |
| Finish reasons   | `gen_ai.response.finish_reasons` (array; per-choice; `stop`, `length`, `tool_calls`, …) ![D] | `gen_ai.response.finish_reason` (singular, legacy) + `gen_ai.response.stop_reason` (Anthropic-style) | `llm.finish_reason`              | `gen_ai.response.finish_reasons`, `ai.response.finishReason` |

**Trap:** the `finish_reasons` (plural array) vs `finish_reason` (singular string) split is the source of many cross-tool bugs. OTel mandates plural-array because a request can return multiple choices; OpenLLMetry kept singular for ergonomics.

### Multi-turn / session

| Concept             | OTel official                    | OpenLLMetry                                        | OpenInference | Vercel AI SDK                          | LangSmith                    |
| ------------------- | -------------------------------- | -------------------------------------------------- | ------------- | -------------------------------------- | ---------------------------- |
| Conversation/thread | `gen_ai.conversation.id` ![D]    | (use `traceloop.association.properties.thread_id`) | `session.id`  | (use `ai.telemetry.metadata.threadId`) | `langsmith.trace.session_id` |
| User                | (none)                           | `gen_ai.user`                                      | `user.id`     | (use metadata)                         | (use metadata)               |
| Tags                | (none — use OTel resource attrs) | `traceloop.association.properties.tags`            | `tag.tags`    | `ai.telemetry.metadata.*`              | `langsmith.span.tags`        |

### Embeddings

| Concept       | OTel official                            | OpenLLMetry                                    | OpenInference                                                   | Vercel AI SDK                         |
| ------------- | ---------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| Op name       | `gen_ai.operation.name = embeddings`     | `traceloop.span.kind` (none) + `gen_ai.system` | `openinference.span.kind = EMBEDDING`                           | `ai.embed` / `ai.embedMany` span name |
| Dimensions    | `gen_ai.embeddings.dimension.count` ![D] | (none)                                         | (none)                                                          | (none)                                |
| Encoding      | `gen_ai.request.encoding_formats` ![D]   | (none)                                         | (none)                                                          | (none)                                |
| Input text    | (use `gen_ai.input.messages` style)      | `gen_ai.prompt` (legacy)                       | `embedding.text`, `embedding.embeddings.{i}.embedding.text`     | `ai.value`, `ai.values`               |
| Output vector | (not emitted)                            | (not emitted)                                  | `embedding.vector`, `embedding.embeddings.{i}.embedding.vector` | `ai.embedding`, `ai.embeddings`       |
| Model         | `gen_ai.request.model`                   | `gen_ai.request.model`                         | `embedding.model_name`                                          | `gen_ai.request.model`, `ai.model.id` |

Note: Vercel embedding spans **do not** emit any `gen_ai.*` attributes — by design.

### Retrieval / RAG

| Concept            | OTel official                                              | OpenLLMetry                                                                                 | OpenInference                                                  |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Op name            | `gen_ai.operation.name = retrieval` ![D]                   | `db.system=pinecone/chroma/…`                                                               | `openinference.span.kind = RETRIEVER`                          |
| Data source id     | `gen_ai.data_source.id` ![D]                               | (provider-specific: `pinecone.query.namespace`, `chroma.collection.name`, etc.)             | (none standard)                                                |
| Query text         | `gen_ai.retrieval.query.text` (Opt-In) ![D]                | (provider-specific)                                                                         | (use `input.value`)                                            |
| Top-k              | `gen_ai.request.top_k` ![D]                                | `db.vector.query.top_k`, `pinecone.query.top_k`                                             | `reranker.top_k` (for rerankers)                               |
| Returned documents | `gen_ai.retrieval.documents = [{id, score}]` (Opt-In) ![D] | `db.vector.query.result_count`, `db.vector.query.top_score`, `db.vector.query.top_distance` | `retrieval.documents.{i}.document.{id,score,content,metadata}` |

OpenLLMetry has by far the deepest provider-specific coverage here. The OTel `retrieval` span and `gen_ai.data_source.id` were added in v1.38 to fill the gap, but the document-list shape is intentionally minimal (id + score only by default).

### Multimodal

- **OTel:** message parts include `type: "image"` or `type: "audio"` inside `gen_ai.input.messages` / `gen_ai.output.messages`. Output modality at the request level: `gen_ai.output.type` ∈ {text, json, image, speech}. No dedicated URL or MIME attribute on the span — those live inside the parts object.
- **OpenInference:** `MessageContentAttributes.MESSAGE_CONTENT_TYPE`, `MESSAGE_CONTENT_TEXT`, `MESSAGE_CONTENT_IMAGE`; `ImageAttributes.IMAGE_URL`; `AudioAttributes.AUDIO_URL`, `AUDIO_MIME_TYPE`, `AUDIO_TRANSCRIPT`. Most explicit of any spec.
- **OpenLLMetry:** lives entirely inside `gen_ai.prompt` / `gen_ai.completion` JSON blobs; no flat keys.
- **Vercel AI SDK:** lives entirely inside `ai.prompt.messages` JSON blob.

### Metrics (sidecar to spans)

OTel gen_ai defines six metrics. None are required, but they're widely emitted alongside spans:

| Metric                                          | Type      | Unit      | Attributes                                                                                                                                                    |
| ----------------------------------------------- | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gen_ai.client.token.usage`                     | Histogram | `{token}` | `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.token.type` (input/output), `gen_ai.request.model`, `gen_ai.response.model`, `server.{address,port}` |
| `gen_ai.client.operation.duration`              | Histogram | `s`       | same as above (no token.type)                                                                                                                                 |
| `gen_ai.client.operation.time_to_first_chunk`   | Histogram | `s`       | same                                                                                                                                                          |
| `gen_ai.client.operation.time_per_output_chunk` | Histogram | `s`       | same                                                                                                                                                          |
| `gen_ai.server.request.duration`                | Histogram | `s`       | server side                                                                                                                                                   |
| `gen_ai.server.time_per_output_token`           | Histogram | `s`       | server side                                                                                                                                                   |
| `gen_ai.server.time_to_first_token`             | Histogram | `s`       | server side                                                                                                                                                   |
| `gen_ai.workflow.duration`                      | Histogram | `s`       | workflow                                                                                                                                                      |

llmflow's `metrics` table already accepts these — see "where llmflow is incomplete" below for how to map them to per-model rollups.

### Events

| Event name                                  | Status                | Purpose                                                                                                                                                                                             |
| ------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gen_ai.client.inference.operation.details` | ![D] **Current**      | Consolidated event carrying full request/response (incl. `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.system_instructions`, `gen_ai.tool.definitions`). Replaces all per-role events. |
| `gen_ai.evaluation.result`                  | ![D] **Current**      | Evaluator output. Attrs: `gen_ai.evaluation.name`, `gen_ai.evaluation.score.label`, `gen_ai.evaluation.score.value` (double), `gen_ai.evaluation.explanation`, `gen_ai.response.id`.                |
| `gen_ai.system.message`                     | **Deprecated** v1.38  | Use `gen_ai.system_instructions` attribute or `gen_ai.input.messages`                                                                                                                               |
| `gen_ai.user.message`                       | **Deprecated** v1.38  | Use `gen_ai.input.messages`                                                                                                                                                                         |
| `gen_ai.assistant.message`                  | **Deprecated** v1.38  | Use `gen_ai.input.messages`                                                                                                                                                                         |
| `gen_ai.tool.message`                       | **Deprecated** v1.38  | Use `gen_ai.input.messages` (as `type=tool_call_response` part)                                                                                                                                     |
| `gen_ai.choice`                             | **Deprecated** v1.38  | Use `gen_ai.output.messages`                                                                                                                                                                        |
| `gen_ai.content.prompt`                     | OpenLLMetry-flavoured | Pre-OTel event name, still in the wild                                                                                                                                                              |
| `gen_ai.content.completion`                 | OpenLLMetry-flavoured | Pre-OTel event name, still in the wild                                                                                                                                                              |

## Data model recommendations for llmflow

### Principles

1. **Tolerate every dialect on read; normalise to OTel v1.38 on write.** The `transformSpan` function in `otlp.js` is the right place to do this — but it currently only handles ~30% of what's in the wild.
2. **Promote a small set of high-cardinality / high-query-frequency fields to columns.** Everything else goes into `attributes` JSON. The current set (`provider`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `estimated_cost`, `span_type`, `service_name`) is right for analytics. Add: `operation_name`, `agent_name`, `conversation_id`, `session_id`, `response_id`, `finish_reason`, `is_streaming`, `cache_read_tokens`, `cache_creation_tokens`, `reasoning_tokens`, `time_to_first_chunk_ms`.
3. **Separate "span kind" from "operation name".** Today `span_type` conflates the two (it accepts both `llm`/`agent`/`tool`/`workflow` _and_ `embedding`/`retrieval`). Two columns:
   - `span_kind` (UI/grouping): one of `llm`, `embedding`, `retrieval`, `tool`, `agent`, `workflow`, `chain`, `reranker`, `guardrail`, `evaluator`, `prompt`, `custom`.
   - `operation_name` (the OTel attribute, verbatim): `chat`, `embeddings`, `retrieval`, `execute_tool`, `invoke_agent`, etc. NULL for non-gen_ai spans.
4. **Store messages structurally — not as a fused `input`/`output` blob.** Add a `messages` JSON column (typed: `Array<{role, parts: Array<TextPart|ToolCallPart|ToolResultPart|ImagePart|AudioPart>}>`). Map every dialect into this shape at ingest. Keep the existing `input`/`output` columns for non-gen_ai spans (raw HTTP bodies, etc.) but stop trying to make them carry gen_ai content.
5. **Store tool definitions and tool calls as first-class arrays alongside messages.** This is what trace viewers always want to render side-by-side. Don't make them dig through nested message parts.

### Proposed schema delta

```sql
ALTER TABLE traces ADD COLUMN operation_name TEXT;          -- gen_ai.operation.name
ALTER TABLE traces ADD COLUMN span_kind TEXT;               -- UI grouping (LLM/CHAIN/AGENT/...)
ALTER TABLE traces ADD COLUMN agent_name TEXT;              -- gen_ai.agent.name
ALTER TABLE traces ADD COLUMN agent_id TEXT;                -- gen_ai.agent.id
ALTER TABLE traces ADD COLUMN conversation_id TEXT;         -- gen_ai.conversation.id
ALTER TABLE traces ADD COLUMN session_id TEXT;              -- session.id / langsmith.trace.session_id
ALTER TABLE traces ADD COLUMN user_id TEXT;                 -- user.id / gen_ai.user
ALTER TABLE traces ADD COLUMN response_id TEXT;             -- gen_ai.response.id
ALTER TABLE traces ADD COLUMN response_model TEXT;          -- gen_ai.response.model (distinct from request)
ALTER TABLE traces ADD COLUMN finish_reasons TEXT;          -- JSON array
ALTER TABLE traces ADD COLUMN is_streaming INTEGER;         -- 0/1
ALTER TABLE traces ADD COLUMN time_to_first_chunk_ms REAL;  -- gen_ai.response.time_to_first_chunk * 1000
ALTER TABLE traces ADD COLUMN cache_read_tokens INTEGER;    -- gen_ai.usage.cache_read.input_tokens
ALTER TABLE traces ADD COLUMN cache_creation_tokens INTEGER;-- gen_ai.usage.cache_creation.input_tokens
ALTER TABLE traces ADD COLUMN reasoning_tokens INTEGER;     -- gen_ai.usage.reasoning.output_tokens
ALTER TABLE traces ADD COLUMN messages TEXT;                -- normalised JSON of input+output messages
ALTER TABLE traces ADD COLUMN system_instructions TEXT;     -- gen_ai.system_instructions (JSON)
ALTER TABLE traces ADD COLUMN tools TEXT;                   -- gen_ai.tool.definitions (JSON)
ALTER TABLE traces ADD COLUMN tool_call_id TEXT;            -- gen_ai.tool.call.id (for execute_tool spans)
ALTER TABLE traces ADD COLUMN tool_name TEXT;               -- gen_ai.tool.name (for execute_tool spans)
ALTER TABLE traces ADD COLUMN data_source_id TEXT;          -- gen_ai.data_source.id (retrieval)

CREATE INDEX idx_traces_operation_name ON traces(operation_name);
CREATE INDEX idx_traces_span_kind ON traces(span_kind);
CREATE INDEX idx_traces_conversation_id ON traces(conversation_id);
CREATE INDEX idx_traces_session_id ON traces(session_id);
CREATE INDEX idx_traces_agent_name ON traces(agent_name);
```

Cost stays as `estimated_cost` (REAL). If a span carries OpenInference's `llm.cost.*` attributes, prefer those over the pricing-table lookup and mark the source (`cost_source TEXT` ∈ {`derived`, `openinference`, `provider`}) — though that's a v0.5 polish.

### Normalisation rules (the "resolve the same field from N candidate keys" table)

For each column, resolve in priority order, fall back through dialects:

- **`provider`:** `gen_ai.provider.name` → `gen_ai.system` → `llm.provider` → `llm.vendor` → null. (Never use `service.name` — it's the calling app.)
- **`model` (request):** `gen_ai.request.model` → `llm.model_name` → `ai.model.id` → `embedding.model_name` → null.
- **`response_model`:** `gen_ai.response.model` → `ai.response.model` → null.
- **`operation_name`:** `gen_ai.operation.name` → infer from span name → null.
- **`span_kind`:** explicit `openinference.span.kind` → `traceloop.span.kind` → `langsmith.span.kind` → mapped from `gen_ai.operation.name` → mapped from `ai.operationId` → mapped from `db.system` (vector DB → retrieval) → inferred from span name keywords → `custom`.
- **`prompt_tokens` / `input_tokens`:** `gen_ai.usage.input_tokens` → `gen_ai.usage.prompt_tokens` → `llm.token_count.prompt` → `llm.usage.prompt_tokens` → `ai.usage.promptTokens` → 0.
- **`completion_tokens` / `output_tokens`:** `gen_ai.usage.output_tokens` → `gen_ai.usage.completion_tokens` → `llm.token_count.completion` → `llm.usage.completion_tokens` → `ai.usage.completionTokens` → 0.
- **`total_tokens`:** `gen_ai.usage.total_tokens` → `llm.token_count.total` → `llm.usage.total_tokens` → input + output.
- **`cache_read_tokens`:** `gen_ai.usage.cache_read.input_tokens` → `gen_ai.usage.cache_read_input_tokens` (OpenLLMetry's underscore variant).
- **`cache_creation_tokens`:** `gen_ai.usage.cache_creation.input_tokens` → `gen_ai.usage.cache_creation_input_tokens`.
- **`reasoning_tokens`:** `gen_ai.usage.reasoning.output_tokens` → `gen_ai.usage.reasoning_tokens`.
- **`conversation_id`:** `gen_ai.conversation.id` → null. (Distinct from session_id.)
- **`session_id`:** `session.id` → `langsmith.trace.session_id` → `traceloop.association.properties.session_id` → `ai.telemetry.metadata.sessionId` → null.
- **`finish_reasons`:** `gen_ai.response.finish_reasons` (array) → `[gen_ai.response.finish_reason]` (legacy singular → wrap) → `[llm.finish_reason]` → `[ai.response.finishReason]` → null.
- **`is_streaming`:** `gen_ai.request.stream` → `gen_ai.is_streaming` → `llm.is_streaming` → derive from span name prefix (`ai.streamText` → true) → null.
- **`time_to_first_chunk_ms`:** `gen_ai.response.time_to_first_chunk` × 1000 → `ai.response.msToFirstChunk` → null.
- **`tool_name`:** `gen_ai.tool.name` → `tool.name` → `ai.toolCall.name` → null.
- **`tool_call_id`:** `gen_ai.tool.call.id` → `tool_call.id` → `ai.toolCall.id` → null.
- **`agent_name`:** `gen_ai.agent.name` → `agent.name` → `traceloop.entity.name` (when `kind=agent`) → null.
- **`messages`:** materialise from (in priority): `gen_ai.input.messages` + `gen_ai.output.messages` (v1.38 structured) → OpenInference numbered `llm.input_messages.{i}.*` + `llm.output_messages.{i}.*` → OpenLLMetry numbered `gen_ai.prompt.{i}.*` + `gen_ai.completion.{i}.*` → JSON-parsed `gen_ai.prompt` + `gen_ai.completion` blobs → Vercel `ai.prompt.messages` / `ai.response.text|toolCalls` → events: consolidated `gen_ai.client.inference.operation.details` → legacy per-role events `gen_ai.{system,user,assistant,tool}.message` and `gen_ai.choice`.

### Span name preservation

Keep `span_name` exactly as emitted. UI can group on it. The OTel spec's `{operation.name} {request.model}` format is helpful but not universal; many libraries (Mastra, Vercel) emit their own naming.

## Where llmflow's current ingestion is incomplete

In rough order of value:

1. **Structured messages (`gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.system_instructions`)** — `extractIO` only handles `gen_ai.prompt` / `gen_ai.completion` (deprecated in v1.38). Every modern OTel instrumentation emits the structured form. **High value, high impact.**
2. **The `gen_ai.client.inference.operation.details` event** — the consolidated event carrying the full request/response is not parsed at all. `extractIO`'s event loop matches on substring "prompt"/"completion" but never sees this name.
3. **Cache tokens** (`gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.cache_creation.input_tokens`) — material for cost analytics on Anthropic/Bedrock workloads where cache savings are large. Currently lost; need cache-aware cost calc.
4. **Reasoning tokens** (`gen_ai.usage.reasoning.output_tokens`) — critical for cost on o1/o3 and Claude 3.7 extended-thinking. Currently lost.
5. **OpenInference token names** (`llm.token_count.prompt|completion|total`) — Phoenix and Arize-instrumented apps emit only these. `extractTokens` doesn't look at them, so token counts and cost will be **zero** for any Phoenix-using app.
6. **OpenInference cost** (`llm.cost.prompt|completion|total`) — when present, this is the _correct_ cost from the provider response. llmflow recomputes from its pricing table instead.
7. **Operation name** (`gen_ai.operation.name`) — currently flattened into `span_type` via `PROVIDER_TO_SPAN_TYPE`, losing the distinction between `chat` / `embeddings` / `retrieval` / `execute_tool` / `invoke_agent`. A `chat` and an `embeddings` call both end up as `span_type=llm`.
8. **Agent attributes** (`gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.version`, `gen_ai.agent.description`) — not extracted. Important for the trace viewer's agent-grouping UI.
9. **Conversation / session correlation** (`gen_ai.conversation.id`, `session.id`, `langsmith.trace.session_id`) — not extracted. Limits cross-trace conversation reconstruction.
10. **Finish reasons** (`gen_ai.response.finish_reasons`) — not extracted. Critical for distinguishing `length` (truncation) from `stop` (clean finish) in cost/quality analytics.
11. **Streaming metrics** (`gen_ai.response.time_to_first_chunk`, `ai.response.msToFirstChunk`, `ai.response.msToFinish`) — not extracted; TTFB is one of the most-asked-for charts in an LLM observability dashboard.
12. **Tool execution spans** — `execute_tool` spans should surface `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`. Currently `extractIO` doesn't look at these; they end up only in the `attributes` blob.
13. **Tool definitions** (`gen_ai.tool.definitions`) — useful for showing "what tools were available to the model" in the viewer.
14. **Retrieval shape** (`gen_ai.data_source.id`, `gen_ai.retrieval.query.text`, `gen_ai.retrieval.documents`) — `determineSpanType` correctly classifies vector-DB calls as `retrieval`, but no retrieval-specific attributes are surfaced.
15. **OpenInference span kinds** (`openinference.span.kind`) — RERANKER, GUARDRAIL, EVALUATOR, PROMPT, CHAIN are never detected. Phoenix-instrumented apps lose all this structure.
16. **Evaluation events** (`gen_ai.evaluation.result`) — not handled. These should land in the `logs` table (or a dedicated `evaluations` table) with their own foreign key to the span being evaluated.
17. **OTel metric ingestion for token usage** — llmflow's `metrics` table already accepts OTLP metrics, but `getTokenUsage()` looks at name LIKE `%token%` and uses a generic `model` attribute. Should special-case `gen_ai.client.token.usage` and read `gen_ai.token.type` to split input vs output.
18. **`traceloop.association.properties`** — Traceloop-instrumented apps stash their session/user/tags here. llmflow ignores them entirely.
19. **`langsmith.metadata.*`** — same story for LangSmith-instrumented apps.
20. **MCP tool calls** (`mcp.method.name`, `mcp.request.argument`, `mcp.response.value`) — defined in OpenLLMetry; not extracted.

## Where llmflow's current ingestion is wrong

1. **`gen_ai.usage.completion_tokens` is read but `gen_ai.usage.output_tokens` is not** (`otlp.js:145`). New OTel-conformant clients emit only `output_tokens` and llmflow will report **zero completion tokens** for them. Same bug for `input_tokens` vs `prompt_tokens`.
2. **`determineSpanType` returns `llm` whenever `gen_ai.system` is set** (`otlp.js:96`) — including for embedding, retrieval, and tool execution spans. An `execute_tool` span will appear as `span_type=llm` if it happens to carry a `gen_ai.system`/`gen_ai.provider.name` attribute (which the spec encourages).
3. **`PROVIDER_TO_SPAN_TYPE` keyed off `gen_ai.system`** (`otlp.js:20`) — the value `gen_ai.system` was renamed to `gen_ai.provider.name` in v1.30 of the spec; new conformant emitters won't set the old key. `extractAttributes` will populate provider correctly because `provider` extraction (`otlp.js:249`) tries both, but `determineSpanType` only looks at `gen_ai.system`.
4. **`PROVIDER_TO_SPAN_TYPE` doesn't include new v1.38 provider values** (`aws.bedrock`, `azure.ai.inference`, `azure.ai.openai`, `gcp.gemini`, `gcp.gen_ai`, `gcp.vertex_ai`, `deepseek`, `ibm.watsonx.ai`, `mistral_ai`, `perplexity`, `x_ai`). Spans from those providers fall through to the span-name keyword heuristic.
5. **`extractIO` matches event name `includes('prompt')`** (`otlp.js:188`) — too loose. The intended event names are `gen_ai.system.message`, `gen_ai.user.message`, `gen_ai.assistant.message`, `gen_ai.tool.message`, `gen_ai.choice` (legacy) and `gen_ai.client.inference.operation.details` (current). The substring match will fire on any event with "prompt" in the name and silently overwrite `input` with the wrong event's attributes.
6. **`extractIO` overwrites `input`/`output` inside its event loop** instead of merging — last-event-wins, which is wrong for multi-turn conversations where multiple `gen_ai.user.message` events legitimately exist on one span.
7. **`extractAttributes` drops `kvlistValue` types** — the OTLP value type for nested objects is `kvlistValue: { values: [...] }`, and llmflow's extractor only handles `stringValue` / `intValue` / `doubleValue` / `boolValue` / `arrayValue`. New v1.38 structured attributes (`gen_ai.input.messages`, `gen_ai.tool.definitions`) MAY arrive as `kvlistValue` — silently dropped today.
8. **`extractAttributes` doesn't handle `bytesValue`** — same family of bug, less common but real for image/audio attribute parts.
9. **`response_status` is forced to equal `status`** (`otlp.js:275`) — but `status` here is an HTTP-style code derived from OTel span status (`200` or `500`), not the actual HTTP response status. For proxy-mode requests the response status is meaningful and distinct; for OTLP-ingested spans it's misleading to populate it.
10. **`status` defaults to `200`** even when `span.status.code === 0 (UNSET)`. An unset status is "we don't know", not "OK". The dashboard counts this as success and inflates the success rate.
11. **`total_tokens` falls back to `prompt + completion`** (`otlp.js:267`) — fine for OTel official (no `total` attribute) but it masks the case where the provider returned a `total` that's larger than `prompt + completion` (because of e.g. system/scratchpad tokens). Should prefer the explicit total when emitted.
12. **`estimatedCost` recomputes from pricing table even when the provider/SDK gave us an exact cost** — OpenInference `llm.cost.total` is ignored. Same for any provider-specific `*.cost.*` attribute.
13. **`normalizeId` returns hex untouched** (`otlp.js:54`) — fine for storage, but trace_id and span_id in OTLP are 32-char and 16-char lowercase hex respectively. The function doesn't validate, so a malformed id silently passes through. Worth at least logging a debug warning.
14. **Provider extraction falls back to `llm.vendor`** (`otlp.js:252`) but not to OpenInference's `llm.provider` or `llm.system`, nor to `gen_ai.provider.name` (which IS read, good), nor to OpenLLMetry's `gen_ai.system` (which is read). The `llm.vendor` key is rare in the wild; `llm.provider` is common (Phoenix).
15. **`TRACELOOP_KIND_TO_SPAN_TYPE`** maps `workflow → trace` — but `trace` is not a valid span_type in the documented set (spans of type `trace` will look weird in the UI). Should be `workflow` or be rolled into a `span_kind` column.
16. **Span kind sniffing on raw span name** (`otlp.js:115`) — `if (spanName.includes('embed'))` will match a span literally named `"Customer embedded a tweet"`. Brittle; should only fire after the gen_ai discriminators have all returned null, not as a co-equal signal.
17. **`extractIO` parses `gen_ai.prompt` / `gen_ai.completion` as either JSON or string** — but the spec (when these were defined) required them to be JSON strings of objects following a numbered structure. The fallback `{ prompt: attrs['gen_ai.prompt'] }` silently corrupts the shape that the UI expects.

## Open questions

1. **Do we want a separate `events` table or store gen_ai events inline in `logs`?** The current `logs` table is general-purpose. A `gen_ai.client.inference.operation.details` event carries ~5KB of structured data per LLM call; storing them in `logs` works but loses the "this event is the canonical content for this span" relationship. Option: dedicated `span_events` table joined on `(trace_id, span_id)`.
2. **How to handle the 80% overlap between events and attributes?** v1.38 says the same content can be on the span (as attrs) OR in the event — never both. In practice both arrive. Dedup strategy?
3. **`gen_ai.tool.definitions` can be enormous** (a 20-tool spec for a Claude-driven agent is ~30KB). Always store, or store hash + content separately, or store first invocation per `conversation_id` only?
4. **OpenInference numbered keys ingestion is O(n²) on attribute count** unless we collect them in one pass. Worth designing a "shape-detector" that picks numbered-vs-structured-vs-event up front?
5. **Cost reconciliation:** if both OpenInference `llm.cost.*` and llmflow-derived cost disagree, which wins? Probably OpenInference (closer to the source), but the user should be able to override.
6. **Streaming chunks in events** — the spec leaves this `TODO`. Some emitters (OpenLLMetry) use `gen_ai.content.completion.chunk` events; others emit nothing. Do we want to reconstruct streaming timelines from those, or ignore?
7. **MCP spans (`mcp.client.*`)** — the OTel spec defines an MCP convention. Should llmflow emit a distinct `span_kind = mcp` or roll into `tool`?
8. **Multi-tenant `session_id` collisions:** OpenInference's `session.id` is unscoped. If two tenants both write `session.id = "default"`, they collide. Suggest scoping by `service_name` for queries.
9. **Schema version stamping:** worth adding `otel_schema_url` (e.g. `https://opentelemetry.io/schemas/gen-ai/1.42.0`) per span so the UI can show which spec version produced each trace? Useful during the v1.30→v1.38 transition.
10. **Stable-only mode:** currently llmflow happily ingests Development-stability attributes. If/when OTel stabilises gen_ai, should we offer a "strict" mode that only accepts attributes whose stability is `stable` or the gen_ai-stable subset?

## Sources

- [OpenTelemetry Generative AI semantic conventions repo](https://github.com/open-telemetry/semantic-conventions-genai)
- [`gen-ai-spans.md`](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md), [`gen-ai-agent-spans.md`](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md), [`gen-ai-events.md`](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-events.md), [`gen-ai-metrics.md`](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md)
- [OTel Python contrib `instrumentation-genai/opentelemetry-instrumentation-openai-v2`](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation-genai/opentelemetry-instrumentation-openai-v2)
- [OpenLLMetry / Traceloop `opentelemetry-semantic-conventions-ai`](https://github.com/traceloop/openllmetry/blob/main/packages/opentelemetry-semantic-conventions-ai/opentelemetry/semconv_ai/__init__.py)
- [Traceloop deprecation issue #3515](https://github.com/traceloop/openllmetry/issues/3515)
- [OpenInference Python `semconv/trace`](https://github.com/Arize-ai/openinference/blob/main/python/openinference-semantic-conventions/src/openinference/semconv/trace/__init__.py)
- [Vercel AI SDK telemetry docs](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)
- [Mastra OTel exporter `gen-ai-semantics.ts`](https://github.com/mastra-ai/mastra/blob/main/observability/otel-exporter/src/gen-ai-semantics.ts)
- [LangSmith Trace with OpenTelemetry docs](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [LangSmith Collector-Proxy](https://github.com/langchain-ai/langsmith-collector-proxy)
