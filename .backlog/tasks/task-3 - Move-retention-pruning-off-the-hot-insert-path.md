---
id: TASK-3
title: Move retention pruning off the hot insert path
status: To Do
assignee: []
created_date: '2026-05-27 02:21'
labels:
  - perf
  - p1
dependencies: []
references:
  - 'packages/db/src/index.ts:444-446'
  - 'todos.md:88'
modified_files:
  - packages/db/src/index.ts
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every insertTrace/insertLog/insertMetric currently runs getCount() then DELETE WHERE id NOT IN (SELECT … ORDER BY timestamp DESC LIMIT cap). That's O(N) per write across all three tables. Should run on cadence, or use a timestamp cursor and only when count drifts past the cap.
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
Option A: counter per insert function, prune when (insert_count % 100 === 0) AND (db_count > cap). Option B: replace 'DELETE … WHERE id NOT IN' with a timestamp cursor DELETE FROM x WHERE timestamp < (SELECT timestamp FROM x ORDER BY timestamp DESC LIMIT 1 OFFSET cap). B is the better long-term shape.
<!-- SECTION:PLAN:END -->
