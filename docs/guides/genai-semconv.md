# GenAI Semantic Conventions

LLMFlow ingests traces, logs, and metrics that follow the
[OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/).
The spec is currently in **Development** status — it has been through one round
of major renames already, and may go through more before reaching Stable.

LLMFlow's OTLP ingest is deliberately liberal: it accepts both the current
spec attribute names and the deprecated v1.36.0 names that older
instrumentations still emit. You shouldn't need to configure anything on the
sender side — whatever your SDK emits, LLMFlow will normalize it.

## What LLMFlow consumes on ingest

### Span classification

The `span_type` LLMFlow assigns is derived from these signals, in priority order:

| Signal | Source | Result |
|---|---|---|
| `gen_ai.operation.name` | Current spec | Highest priority. See operation table below. |
| `traceloop.span.kind` | OpenLLMetry framework | Used by LangChain instrumentation. |
| `gen_ai.provider.name` or `gen_ai.system` | Current + deprecated spec | Falls back to `llm` if provider known. |
| `llm.request.type` | Legacy | `llm` |
| `db.system` (vector DBs) | OTel DB semconv | `retrieval` for pinecone/chroma/weaviate/qdrant/milvus/pgvector |
| Span name heuristics | Fallback | `embed*`, `retriev*`/`search`, `agent`, `tool`/`function`, `chain` |

#### Operation → span_type mapping

| `gen_ai.operation.name` | LLMFlow `span_type` |
|---|---|
| `chat`, `text_completion`, `generate_content` | `llm` |
| `embeddings` | `embedding` |
| `execute_tool` | `tool` |
| `create_agent`, `invoke_agent` | `agent` |
| `invoke_workflow` | `chain` |
| `retrieval` | `retrieval` |

### Token usage (dual-read)

LLMFlow reads token counts from current-spec names first, then falls back to
deprecated v1.36.0 names. The DB columns `prompt_tokens` and
`completion_tokens` are populated from whichever name was sent.

| Field | Current spec | Deprecated (v1.36.0) | Also accepted |
|---|---|---|---|
| Input | `gen_ai.usage.input_tokens` | `gen_ai.usage.prompt_tokens` | `llm.usage.prompt_tokens`, `llm.token_count.prompt` |
| Output | `gen_ai.usage.output_tokens` | `gen_ai.usage.completion_tokens` | `llm.usage.completion_tokens`, `llm.token_count.completion` |

Additional token fields are captured into the span's `attributes` blob (no
dedicated DB column) and surface in the dashboard's span detail view:

- `gen_ai.usage.cache_creation.input_tokens` — Anthropic prompt-cache write
- `gen_ai.usage.cache_read.input_tokens` — Anthropic prompt-cache hit
- `gen_ai.usage.reasoning.output_tokens` — o1-style reasoning tokens

### Provider

LLMFlow reads `gen_ai.provider.name` first, falling back to the deprecated
`gen_ai.system`, then to `llm.vendor`. It deliberately **does not** fall back
to `service.name` — that identifies the calling application, not the LLM
backend.

Recognized providers include: `openai`, `anthropic`, `aws.bedrock`,
`azure.ai.openai`, `gcp.gemini`, `gcp.gen_ai`, `gcp.vertex_ai`, `cohere`,
`mistral_ai`, `groq`, `together`, `ollama`, `replicate`, `deepseek`,
`perplexity`, `x_ai`, `ibm.watsonx.ai`.

### Input / output messages

LLMFlow extracts span input/output in this order:

1. `gen_ai.input.messages` / `gen_ai.output.messages` (current spec, structured
   `[{role, parts: [{type, content|...}]}]` arrays)
2. `gen_ai.system_instructions` (attached to input)
3. `gen_ai.prompt` / `gen_ai.completion` (deprecated v1.36.0 attributes)
4. Span events:
   - `gen_ai.client.inference.operation.details` (current spec; carries
     structured messages in its event attributes)
   - `gen_ai.content.prompt` / `gen_ai.content.completion` (legacy)

Values that look like JSON strings are parsed automatically.

### Other captured fields

These flow through into the `attributes` blob via the generic spread and are
visible in the span detail view:

- **Response metadata** — `gen_ai.response.id`, `gen_ai.response.model`,
  `gen_ai.response.finish_reasons`, `gen_ai.response.time_to_first_chunk`
- **Request parameters** — `gen_ai.request.{temperature, top_p, top_k,
  max_tokens, frequency_penalty, presence_penalty, stop_sequences, seed,
  choice.count, stream, encoding_formats}`
- **Agent** — `gen_ai.agent.{id, name, description, version}`,
  `gen_ai.workflow.name`, `gen_ai.conversation.id`
- **Tool** — `gen_ai.tool.{name, type, description, call.id, call.arguments,
  call.result}`, `gen_ai.tool.definitions`
- **Retrieval** — `gen_ai.data_source.id`, `gen_ai.request.top_k`,
  `gen_ai.retrieval.{query.text, documents}`
- **Embeddings** — `gen_ai.embeddings.dimension.count`

## What LLMFlow emits on export

When you configure `OTLP_EXPORT_ENDPOINT` to forward to an external backend,
LLMFlow emits the **current spec** attribute names by default:

- `gen_ai.operation.name` (derived from `span_type`)
- `gen_ai.provider.name`
- `gen_ai.request.model`
- `gen_ai.usage.input_tokens`
- `gen_ai.usage.output_tokens`
- `gen_ai.usage.total_tokens`

If your downstream collector or backend was built against v1.36.0 and doesn't
yet understand the new names, set `LLMFLOW_OTLP_LEGACY_ATTRS=1` to also emit
the deprecated keys (`gen_ai.system`, `gen_ai.usage.prompt_tokens`,
`gen_ai.usage.completion_tokens`) alongside the current ones.

## Stability + sender-side migration

The OTel spec's recommended migration pattern for SDK authors is the
`OTEL_SEMCONV_STABILITY_OPT_IN` environment variable. Set it to
`gen_ai_latest_experimental` to have instrumentation libraries emit the new
attribute names. LLMFlow's ingest doesn't care which mode your SDK is in — it
accepts both — but the flag is the official path for SDKs that support it.

## References

- Index: <https://opentelemetry.io/docs/specs/semconv/gen-ai/>
- Model spans: <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/>
- Agent spans: <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/>
- Events / logs: <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/>
- Metrics: <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/>
- Attribute registry: <https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/>
