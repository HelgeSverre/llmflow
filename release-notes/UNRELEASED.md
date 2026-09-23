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

## Renamed (breaking)

- API JSON: `total_requests`, `requests` and `count` are now `request_count`; `avg_duration`
  and `avg_latency` are now `avg_duration_ms` (`/api/stats`, `stats_update`, `/api/models`,
  `/api/analytics`). `/api/analytics` returns `by_service` instead of `by_tool`. Timeline items
  no longer carry `tool` and the endpoint no longer accepts `?tool=`; use `service_name`.
  `/providers` uses `display_name`; the proxy `/health` no longer reports `idleTimeout`.
- `OTLP_EXPORT_FLUSH_INTERVAL` is now `OTLP_EXPORT_FLUSH_INTERVAL_MS`.
- Examples read `LLMFLOW_URL` and `LLMFLOW_PROXY_URL` (were `LLMFLOW_DASHBOARD`, `LLMFLOW_PROXY`).
  The SDK reads `LLMFLOW_VERBOSE` (was `LLMFLOW_DEBUG`).
- Records without a service name are stored as `unknown_service` everywhere (OTLP used
  `unknown`/`otel`, `/api/spans` and the SDK used `app`, proxied calls had none).
- `OLLAMA_HOST` defaults to `127.0.0.1` (was `localhost`).

## Changed

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
