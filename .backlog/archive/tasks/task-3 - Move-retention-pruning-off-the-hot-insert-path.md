---
id: TASK-3
title: Move retention pruning off the hot insert path
status: To Do
assignee: []
created_date: '2026-05-27 02:21'
updated_date: '2026-09-21 09:53'
labels:
  - perf
  - p1
dependencies: []
references:
  - packages/db/src/index.ts
  - packages/db/src/migrations.ts
  - apps/server/test/database-regressions.test.ts
modified_files:
  - packages/db/src/index.ts
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retention still runs synchronously during inserts. Trace retention now uses retention_counts and deletes whole traces, avoiding the old trace COUNT(*) scan. Logs and metrics still count/prune on their write paths. Move remaining maintenance off hot paths without regressing whole-trace retention or bounded deletion markers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pruning no longer runs on every insert
- [ ] #2 Retention cap is still enforced within a reasonable lag (≤100 inserts past the cap)
- [ ] #3 Applies to traces, logs, and metrics insert paths
- [ ] #4 Benchmark: insert throughput improves on a DB already at the cap
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Measure current insertion latency. Introduce bounded maintenance cadence for each signal; reuse trace counters and preserve trace-level deletion and marker cleanup. Verify cap lag and compare insertion latency at large row counts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Partial optimization already exists for traces. Background maintenance and the requested performance benchmark remain unfinished.

2026-09-21 product-scope pruning: No measured user-visible ingest slowdown is recorded. Existing trace retention is already optimized. Reopen only with a reproducible slow workload; do not require background maintenance merely as an architectural preference.
<!-- SECTION:NOTES:END -->
