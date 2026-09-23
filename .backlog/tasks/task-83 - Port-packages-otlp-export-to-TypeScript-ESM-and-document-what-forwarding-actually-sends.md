---
id: TASK-83
title: >-
  Port packages/otlp export to TypeScript ESM and document what forwarding
  actually sends
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 12:59'
labels:
  - typescript
milestone: m-0
dependencies:
  - TASK-82
references:
  - packages/otlp/src/export.js
  - apps/server/src/server.ts
priority: medium
type: task
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`export.js` uses Node `http`/`https` (:335-381) → fetch. `traceToOtlpSpan` (:82-149) rebuilds each span from a fixed attribute list, so `session.id`, other span attributes and prompt/response content are dropped before reaching Langfuse/Jaeger etc., and stored rows have no resource attributes. Export is JSON-only (`:343,351`), so Phoenix (protobuf-only) cannot receive it. `OTLP_EXPORT_ENDPOINT` applies to traces only (`:21-23`) although docs say all signals. `exportTraces/Logs/Metrics`, `queueTrace/Log/Metric` have no external users; `stopExport()` already calls `flushAll()` yet `server.ts:1027-1028` flushes twice; `EXPORT_ENABLED ?` guards at `server.ts:1013`/`dev.ts:66` are redundant (`initExportHooks` returns a no-op).
Port, prune, and decide explicitly (in the task notes) whether to forward span attributes + session_id; at minimum forward `session.id` and stop advertising pass-through.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/otlp export is TypeScript ESM using fetch; unused exports removed; single flush on shutdown
- [x] #2 Forwarded spans include session.id and the decision on other attributes is recorded in the task notes and README
- [x] #3 OTLP_EXPORT_ENDPOINT semantics (traces-only vs all signals) are one thing in code, .env.example and README
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Port export.js to TS ESM with fetch; one generic batch/flush path; export only what server/dev/tests use. 2. Forward session.id, conversation, agent, span attributes and span kind; record the decision. 3. Add OTLP_EXPORT_PROTOCOL=http/protobuf. 4. Single flush on shutdown; drop EXPORT_ENABLED guards. 5. OTLP_EXPORT_ENDPOINT = traces-only alias in code, .env.example, README. 6. Tests + gate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision (forwarded span content): forwarded spans carry the GenAI usage attributes, session.id, gen_ai.conversation.id, gen_ai.agent.name, llmflow.span_name/span_type/cost, service.name, AND every attribute stored on the span except internal bookkeeping keys (_spanName, otel_span_kind) and nulls; stored columns win when an attribute has the same key. The original OTLP span kind is kept (defaults to CLIENT for proxy spans). Proxy-captured request/response bodies are NOT converted into gen_ai.input/output.messages: content capture stays opt-in at the source. Note that for OTLP-ingested spans the stored attributes include the resource attributes that ingestion merged in, so those are forwarded as span attributes too. Documented in README 'Forwarding to another backend'.
Decision (OTLP_EXPORT_ENDPOINT): stays a traces-only alias for OTLP_EXPORT_TRACES_ENDPOINT (existing behaviour; changing it to a base URL would break configs). Logs/metrics need their own *_ENDPOINT. Same wording in export.ts comment, .env.example and README.
Other facts:
- New OTLP_EXPORT_PROTOCOL: http/json (default) | http/protobuf; unknown values warn and fall back to JSON. Protobuf converts hex IDs to bytes and keeps 64-bit nanosecond timestamps exactly (protobufjs has long.js). Tested by encode -> decode.
- anyValue now exports safe integers as intValue (string) instead of doubleValue.
- export.ts exports: initExportHooks, flushAll, getConfig (now includes protocol), encodePayload, build{Traces,Logs,Metrics}Payload, traceToOtlpSpan, logToOtlpRecord, metricToOtlpMetric, OtlpMetric. EXPORT_ENABLED, exportX, queueX removed. initExportHooks returns an async no-op when disabled, so callers need no guard.
- export.ts reads OTLP_EXPORT_* on import: callers that set env first must import it dynamically (telemetry-regressions.test.ts, apps/server/scripts/dev.ts do). TASK-90 should fold these into the config module.
- server.ts shutdown: stop listeners, then await stopExport() (unsubscribes + one flushAll).
- packages/otlp/tsconfig.json no longer excludes export.test.ts; the whole package typechecks. No require() remains in packages/otlp or apps/server/src/server.ts.
Validation: bun run check green; bun run test 216 pass/1 skip + dashboard 116 (export.test.ts 11 tests incl. forwarded attributes, span kind, protobuf roundtrip; telemetry-regressions forwarding to a live collector; shutdown flush); test:package passed; Playwright 125 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported OTLP export to TypeScript ESM using fetch with one batching path, forwarded session/conversation/agent IDs, span attributes and span kind, added http/protobuf export, made shutdown flush once, and documented OTLP_EXPORT_ENDPOINT as traces-only in code, .env.example and README. Verified with export unit tests (incl. protobuf roundtrip), telemetry forwarding tests, bun run check/test, test:package and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
