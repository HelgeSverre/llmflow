---
id: TASK-95
title: Decide whether to rename the traces table and /api/traces to spans
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 19:18'
labels:
  - naming
  - db
milestone: m-0
dependencies:
  - TASK-94
references:
  - packages/db/src/index.ts
priority: low
type: spike
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `traces` table stores spans; `/api/traces` returns spans and `:id` is a span id; `MAX_TRACES` counts span rows; `/health` reports `traces` as a span count (`server.ts:927`); `POST /api/spans` writes into `traces`. Renaming touches the schema (migration), every query, the dashboard stores and the SDK. Time-box: write up cost/benefit and either do it as its own task or record "won't fix" in ARCHITECTURE.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A written decision exists in the task notes and ARCHITECTURE.md; if 'rename', a follow-up task with migration plan is created
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Time-boxed decision: weigh cost/benefit of renaming the traces table and /api/traces to spans; record it in the task notes and ARCHITECTURE.md; on 'rename', create a follow-up task with the migration plan.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision: RENAME (the user approved renaming at the start of the cleanup run, 2026-09-23).
Why: the traces table holds one row per span, /api/traces/:id takes a span id, MAX_TRACES counts span rows, the proxy /health reports a span count as 'traces', and POST /api/spans already writes into the same table. 'Trace' should mean what it means in OpenTelemetry: the group of spans sharing a trace_id (trace_groups, getSpansByTraceId, wasTraceEvicted keep that meaning).
Cost: one migration (ALTER TABLE traces RENAME TO spans; SQLite 3.43 in Bun 1.4 rewrites indexes and triggers), a rename across the DB module, API, dashboard and e2e specs, and a breaking change for /api/traces callers and MAX_TRACES users. Pre-1.0; the dashboard is the only known API consumer.
Follow-up: TASK-105 (created with the migration plan; TASK-100 and TASK-102 now depend on it). Decision recorded in ARCHITECTURE.md (new file with the Vocabulary from TASK-94 and a Decisions section; TASK-102 expands it into the full architecture document).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decided to rename the traces table, /api/traces and MAX_TRACES to spans; the reasoning and cost/benefit are in the task notes and ARCHITECTURE.md, and TASK-105 carries the migration plan.
<!-- SECTION:FINAL_SUMMARY:END -->
