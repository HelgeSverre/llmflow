---
id: TASK-106
title: Traces view lists traces; 'trace' never names a single span
status: To Do
assignee: []
created_date: '2026-09-24 01:31'
updated_date: '2026-09-24 01:32'
labels:
  - vocabulary
  - ready-for-agent
milestone: m-1
dependencies: []
references:
  - CONTEXT.md
priority: high
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTEXT.md defines a trace as all spans sharing a trace ID, but the Traces tab lists every span (loadTraces calls GET /api/spans with no parent filter), GET /api/spans/:id returns a span under the JSON key 'trace' while /tree uses 'trace' for the real trace, timeline entries are type 'trace', and the dashboard store, db and server internals name spans Trace/selectTrace/parseTraceRow/replayTrace/traceSubscriptions. Leftover idx_traces_* indexes survived the TASK-95 rename.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Traces view shows one row per trace, represented by its root span (or its earliest stored span for a partial trace), with trace totals
- [ ] #2 No API response uses the key 'trace' for a single span; timeline entries are 'span' or 'log'
- [ ] #3 Dashboard, server and db identifiers that hold a span are named span (store, selection, parse/replay/subscription helpers), and idx_traces_* indexes are renamed by a new migration step
- [ ] #4 Breaking API changes are listed in release-notes/UNRELEASED.md
<!-- AC:END -->
