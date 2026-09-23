---
id: TASK-105
title: 'Rename the traces table, /api/traces and MAX_TRACES to spans'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-23 19:17'
labels:
  - naming
  - db
  - api
milestone: m-0
dependencies:
  - TASK-95
priority: medium
type: task
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The traces table stores one row per span, /api/traces/:id takes a span id, MAX_TRACES counts span rows and POST /api/spans already writes into the same table, so the schema and API contradict themselves wherever a span and a trace (a group of spans) meet. TASK-95 decided to rename (decision in ARCHITECTURE.md). Pre-1.0 and the dashboard is the only known API consumer, so the breaking change is recorded in the release notes rather than kept behind aliases (except MAX_TRACES, still read as a fallback).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existing databases migrate by renaming the table in place with all rows, indexes and triggers kept (tested from the v0.4.1 fixture)
- [ ] #2 The span API is GET /api/spans, GET /api/spans/:id, GET /api/spans/:id/tree and POST /api/spans/:id/replay; /api/traces no longer exists
- [ ] #3 DB functions, types, the dashboard, e2e specs and docs use span names; MAX_SPANS replaces MAX_TRACES (which is still read as a fallback)
- [ ] #4 The breaking changes are listed in release-notes/UNRELEASED.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migration step 7: ALTER TABLE traces RENAME TO spans (SQLite >= 3.26 rewrites indexes, triggers and the COALESCE index); steps 1-6 keep the traces name because they run before it. 2. DB module: SQL FROM/JOIN/INTO traces -> spans; insertTrace/getTraces/getTraceById/getTraceCount/traceSummary/subscribeTraces/Trace -> span names (trace-level helpers such as getSpansByTraceId, wasTraceEvicted, trace_groups keep trace names). 3. API routes /api/spans, /:id, /:id/tree, /:id/replay; proxy /health span count key. 4. Dashboard API calls; e2e specs and seed; tests. 5. MAX_SPANS in config with MAX_TRACES fallback; env docs regenerated. 6. Release notes; gate, test:package, Playwright.
<!-- SECTION:PLAN:END -->
