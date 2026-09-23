---
id: TASK-83
title: >-
  Port packages/otlp export to TypeScript ESM and document what forwarding
  actually sends
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
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
- [ ] #1 packages/otlp export is TypeScript ESM using fetch; unused exports removed; single flush on shutdown
- [ ] #2 Forwarded spans include session.id and the decision on other attributes is recorded in the task notes and README
- [ ] #3 OTLP_EXPORT_ENDPOINT semantics (traces-only vs all signals) are one thing in code, .env.example and README
<!-- AC:END -->
