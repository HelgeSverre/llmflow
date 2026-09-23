# Architecture

This document is being rewritten from the cleaned-up code (TASK-102). Until then it records the
vocabulary and the decisions that other documents and code reviews rely on.

## Vocabulary

One name per concept, in code, API JSON, environment variables and docs:

| Concept | Name | Notes |
| --- | --- | --- |
| One recorded operation (LLM call, tool call, agent step, …) | span | Stored in the `spans` table; `GET /api/spans`. |
| All spans that share a `trace_id` | trace | The dashboard's Traces view lists traces by their root span. |
| The application that produced a record | `service_name` | Never "tool". `unknown_service` when the source names none. |
| Number of requests or spans in an aggregate | `request_count` | |
| Average duration | `avg_duration_ms` | Durations are `duration_ms`. |
| The upstream LLM API | `provider` | Identical for translated and passthrough calls. |
| Forwarding a provider's own API format unchanged | passthrough | `/passthrough/<provider>/*`. |
| Client environment variables | `LLMFLOW_URL`, `LLMFLOW_PROXY_URL` | Dashboard/API and proxy base URLs. |

API JSON uses snake_case only. Millisecond settings end in `_MS`. The default host is `127.0.0.1`.

## Decisions

### Rename the `traces` table and `/api/traces` to spans (2026-09-23, TASK-95)

**Decision: rename.** The `traces` table stores one row per span, `/api/traces/:id` takes a span
id, `MAX_TRACES` counts span rows, and `POST /api/spans` already wrote into it. Calling rows
"traces" made the code and API contradict themselves wherever a trace (a group of spans) and a
span meet: the span tree endpoint, eviction, and the proxy `/health` count.

- Cost: one migration (`ALTER TABLE traces RENAME TO spans`; SQLite carries indexes and
  triggers along), a rename across the DB module, API, dashboard stores and e2e specs, and a
  breaking change for anyone calling `/api/traces` or setting `MAX_TRACES`. LLMFlow is pre-1.0
  and the dashboard is the only known API consumer.
- Benefit: the schema, API and docs say what they store; "trace" is left for what it means in
  OpenTelemetry, a group of spans.
- `MAX_TRACES` becomes `MAX_SPANS`; the old name is still read as a fallback.
- Carried out in TASK-105.
