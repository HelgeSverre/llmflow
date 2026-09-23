---
id: TASK-94
title: 'Naming pass: one name per concept across API JSON, env vars and defaults'
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
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
- [ ] #1 API responses use snake_case only and one name each for request count, latency and service; `tool` no longer appears in routes, params, JSON or CSS
- [ ] #2 One default service name for every ingest path, documented
- [ ] #3 Examples, tests and docs use the same env variable names (LLMFLOW_URL, LLMFLOW_PROXY_URL or the chosen pair) and the same default host
<!-- AC:END -->
