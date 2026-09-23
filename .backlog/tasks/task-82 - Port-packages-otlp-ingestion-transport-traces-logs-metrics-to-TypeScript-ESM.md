---
id: TASK-82
title: >-
  Port packages/otlp ingestion (transport, traces, logs, metrics) to TypeScript
  ESM
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 12:52'
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
- [x] #1 packages/otlp/src ingestion modules are TypeScript ESM importing @llmflow/db with types; typecheck covers them
- [x] #2 One ID normaliser, one bounded body reader (shared with the proxy) and one metric-row builder exist; removed exports have no importers
- [x] #3 All OTLP ingestion tests (JSON, protobuf, gzip, sessions) pass unchanged in behaviour
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Port attributes/timestamps/transport/traces/logs/metrics to TS ESM with typed OTLP shapes. 2. One ids.ts (also used by export.js), one @llmflow/shared/body reader (also used by the proxy), one metric-row builder. 3. Export only what has importers; drop the root export. 4. Consistent service_name default. 5. Gate, test:package, Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- @llmflow/otlp is type: module with exports ./traces ./logs ./metrics ./transport ./timestamps ./ids (all .ts) and ./export (still export.js until TASK-83). Root '.' export removed. It has a tsconfig and typecheck script, so bun run typecheck covers it.
- packages/otlp/tsconfig.json excludes src/export.test.ts until TASK-83 ports export.js (TS inferred types from the CJS module are too narrow; nothing typechecked it before either). TASK-83: remove that exclude.
- export.js (CJS) keeps working inside the type: module package under Bun; it now uses fixedWidthId(id, 32|16) from ./ids instead of its own normalizeTraceId/normalizeSpanId.
- IDs: ids.ts has normalizeId (strip dashes, lowercase), fixedWidthId (export), base64IdToHex (protobuf decode). The dead 'len<=32' branch is gone.
- @llmflow/shared/body: readBoundedBody(stream, limit) -> Buffer | null (null after cancelling once over the limit). OTLP transport maps null to 413; the proxy throws 'Upstream response exceeds 16 MiB' as before.
- Metrics: one metricRow builder; only sum rows carry aggregation_temporality/is_monotonic/start/time_unix_nano/series_key (unchanged).
- service_name: all three signals now use resource service.name or 'unknown'. Traces previously fell back to the instrumentation scope name and then 'otel'. TASK-94 may rename 'unknown'.
- Log bodies still keep integers as strings (extractBody), unlike attribute values (extractAnyValue -> Number); kept on purpose.
- @llmflow/db: optional fields of Trace, Log, Metric and MetricSummary.value_* now accept null (ingestion always passed null; SQLite stores NULL). getTraceById is still untyped (returns unknown) — TASK-93.
- server.ts imports the ingestion modules with ESM import; only @llmflow/otlp/export is still require()d (TASK-83/85).
Validation: bun run check green (otlp now typechecked); bun run test 218 pass/1 skip (telemetry-regressions covers JSON/protobuf x identity/gzip for all three signals; session-extraction; new body.test.ts) + dashboard 116; test:package passed; Playwright 125 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported OTLP ingestion (transport, traces, logs, metrics, attributes, timestamps) to typed TypeScript ESM; consolidated ID normalisation into ids.ts, the bounded body reader into @llmflow/shared/body (shared with the proxy) and metric rows into one builder; trimmed exports to those with importers and made the service_name default consistent. Verified with bun run check/test (all OTLP JSON/protobuf/gzip/session tests pass), test:package and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
