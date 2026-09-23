---
id: TASK-94
title: 'Naming pass: one name per concept across API JSON, env vars and defaults'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 19:16'
labels:
  - naming
milestone: m-0
dependencies:
  - TASK-90
  - TASK-91
  - TASK-82
references:
  - apps/server/src/server.ts
  - examples/README.md
  - packages/sdk
priority: medium
type: task
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- `tool` vs `service_name`: timeline `?tool=` alias (`server.ts:602`), items carry both (621-622, 657-658); `by_tool`, `cost-by-tool`, `getCostByTool`, `.tool-*` CSS all mean service_name.
- Aggregates: request count is `count`/`request_count`/`requests`/`total_requests`; latency is `avg_latency`/`avg_duration`. camelCase in snake_case JSON: `displayName` (`/providers`), `idleTimeout` (proxy `/health`, always 0).
- Default service name differs per ingest path: `'otel'` (otlp traces), `'unknown'` (logs/metrics/proxy), `'app'` (sdk, `/api/spans`).
- Env: examples use `LLMFLOW_DASHBOARD` while `examples/README.md` documents `LLMFLOW_URL`; tests use `PROXY_URL`, examples `LLMFLOW_PROXY`; `VERBOSE` (server) vs `LLMFLOW_DEBUG` (sdk); `PROXY_TIMEOUT_MS` vs `OTLP_EXPORT_FLUSH_INTERVAL` (ms, no suffix); defaults mix `localhost` and `127.0.0.1`.
Decide and apply; the dashboard is the only API consumer so JSON renames are cheap now. Record the chosen vocabulary in ARCHITECTURE.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 API responses use snake_case only and one name each for request count, latency and service; `tool` no longer appears in routes, params, JSON or CSS
- [x] #2 One default service name for every ingest path, documented
- [x] #3 Examples, tests and docs use the same env variable names (LLMFLOW_URL, LLMFLOW_PROXY_URL or the chosen pair) and the same default host
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Choose one name per concept (service_name, request_count, avg_duration_ms, display_name, unknown_service, LLMFLOW_URL/LLMFLOW_PROXY_URL, *_MS, 127.0.0.1). 2. Rename in DB/API, dashboard, e2e. 3. Unify the default service name on every ingest path. 4. Rename env vars and default host across examples, tests, docs; regenerate env docs. 5. Record vocabulary + release notes; gate, test:package, Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Vocabulary (recorded in AGENTS.md Naming; TASK-102 should carry it into ARCHITECTURE.md):
- service_name (never 'tool'); request_count; avg_duration_ms / duration_ms; provider = the upstream (same for translated and passthrough); 'passthrough' for the mode; snake_case JSON keys only.
- Default service name: 'unknown_service' (OpenTelemetry's default), exported as DEFAULT_SERVICE_NAME from @llmflow/shared/config; used by OTLP ingest (all three signals), the proxy (unless X-LLMFlow-Service), POST /api/spans and the SDK (inlined, the SDK cannot import the shared package). Documented in README (OpenTelemetry section and proxy headers).
- Env: clients use LLMFLOW_URL (dashboard/API) and LLMFLOW_PROXY_URL (proxy); millisecond settings end in _MS (OTLP_EXPORT_FLUSH_INTERVAL -> OTLP_EXPORT_FLUSH_INTERVAL_MS); SDK LLMFLOW_DEBUG -> LLMFLOW_VERBOSE; default host 127.0.0.1 in config (OLLAMA_HOST), examples, README, DOCKER_HUB, website, CI curl checks (other backends' own localhost URLs, e.g. Jaeger 4318 or Opik UI 5173, unchanged).
Changes:
- DB: getStats -> request_count, total_duration_ms, avg_duration_ms; getCostByTool -> getCostByService (avg_duration_ms); getDailyStats requests -> request_count; ModelAggregate avg_latency -> avg_duration_ms.
- API: /api/analytics by_tool -> by_service (null service shown as unknown_service); /api/timeline drops ?tool= and the per-item tool field; /providers display_name (ProviderListing type too); proxy /health no idleTimeout.
- Dashboard: stats/analytics/models/timeline stores and Header, AnalyticsTab, ModelsTab, TimelineTab; CSS .h-bar-fill.service-*; test ids cost-by-service-card/chart and timeline-service-filter.
- Tests updated (websocket stats field, reviewed-fixes model latency, proxy default service, Ollama default host, analytics daily fields, e2e ids/params).
- release-notes/UNRELEASED.md 'Renamed (breaking)' lists every rename.
- TASK-100 note: examples now read LLMFLOW_URL / LLMFLOW_PROXY_URL; examples/rag-pipeline still imports the removed ../../packages/sdk/index.js.
Validation: bun run check green; bun run test 228 pass/1 skip + dashboard 116; test:package passed; Playwright 125 passed (one spec asserted ?tool= and was updated to service_name).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Applied one name per concept: request_count, avg_duration_ms and service_name across API JSON, dashboard and CSS (tool is gone), snake_case-only responses, unknown_service as the single default service on every ingest path, and LLMFLOW_URL/LLMFLOW_PROXY_URL, *_MS and 127.0.0.1 across examples, tests and docs; vocabulary recorded in AGENTS.md and breaking renames in the release notes. Verified with bun run check/test, test:package and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
