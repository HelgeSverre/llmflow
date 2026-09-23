---
id: TASK-82
title: >-
  Port packages/otlp ingestion (transport, traces, logs, metrics) to TypeScript
  ESM
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - typescript
  - dead-code
milestone: m-0
dependencies:
  - TASK-77
references:
  - packages/otlp/src/traces.js
  - packages/otlp/src/transport.js
  - packages/otlp/src/metrics.js
  - apps/server/src/proxy.ts
priority: high
type: task
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CommonJS JS that `require()`s the ESM `@llmflow/db` (`traces.js:14`, `logs.js:14`, `metrics.js:14`). While porting, remove the duplication the audit found:
- ID normalisation exists 4× (`logs.js:25`, `traces.js:75` with a dead `if (len<=32) return clean; return clean` branch, `export.js:154-170`, `transport.js:17-24`) → one helper.
- Size-limited body reader duplicated in `transport.js:44-62` and `apps/server/src/proxy.ts:11-31` → one shared helper.
- `processSum`/`processGauge`/`processHistogram` (`metrics.js:67-188`) build the same row 3×.
- Exports nobody imports: `extractBody`, `extractLogEventName`, `normalizeId`, `extractValue`, `process*`, `transformSpan`, `determineSpanType`, `extractModel`, `extractTokens`, `extractAnyValue`, re-exports of `extractAttributes`/`nanoToMs`, the package root `"."`.
- Default `service_name` differs by path: traces `'otel'` (`traces.js:363`), logs/metrics `'unknown'`; pick one (see naming task) but at least make ingest consistent.
Keep `proto.json` and the protobuf/gzip transport behaviour; `telemetry-regressions.test.ts` and the moved otlp tests are the safety net.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/otlp/src ingestion modules are TypeScript ESM importing @llmflow/db with types; typecheck covers them
- [ ] #2 One ID normaliser, one bounded body reader (shared with the proxy) and one metric-row builder exist; removed exports have no importers
- [ ] #3 All OTLP ingestion tests (JSON, protobuf, gzip, sessions) pass unchanged in behaviour
<!-- AC:END -->
