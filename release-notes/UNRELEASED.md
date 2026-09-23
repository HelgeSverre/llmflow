# LLMFlow — Unreleased

## Removed API endpoints

These endpoints had no consumer in the dashboard, SDK, examples or tests. Use the replacements:

| Removed                                | Use instead                                                    |
| -------------------------------------- | -------------------------------------------------------------- |
| `GET /api/token-usage`                 | `GET /api/metrics/tokens`                                      |
| `GET /api/metrics/summary`             | `GET /api/metrics?aggregation=summary`                         |
| `GET /api/analytics/daily`             | `GET /api/analytics` (`daily`)                                 |
| `GET /api/analytics/cost-by-tool`      | `GET /api/analytics` (`by_tool`)                               |
| `GET /api/analytics/cost-by-model`     | `GET /api/analytics` (`by_model`)                              |
| `GET /api/analytics/token-trends`      | `GET /api/analytics` (`daily` carries per-day token totals)    |
| `GET /api/health/providers`            | none; it made live calls to every configured provider          |

The WebSocket no longer sends `trace_log_added` messages (nothing listened for them); `new_log`
still carries the log with its `trace_id`. `stats_update` and `GET /api/stats` no longer include
a `models` array; use `GET /api/models`.

## Changed

- OTLP ingestion attributes records without a `service.name` resource attribute to `unknown`
  for traces too (traces used to fall back to the instrumentation scope name, then `otel`).
- OTLP export forwards `session.id`, `gen_ai.conversation.id`, `gen_ai.agent.name`, the span's
  own attributes and its original span kind. New `OTLP_EXPORT_PROTOCOL=http/protobuf` for
  protobuf-only backends such as Phoenix. `OTLP_EXPORT_ENDPOINT` applies to traces only.
  Integer attributes are exported as `intValue`.
- The offline pricing fallback now covers current models and reports its real age, so the
  dashboard warns when it is more than 7 days old.
- `llmflow-sdk` is built from TypeScript, ESM-only, and versioned with `llmflow`. `traced()`
  works with standard decorators as well as `experimentalDecorators`.

## Internal

- The unused `stats_cache` table is dropped from existing databases by a migration.
