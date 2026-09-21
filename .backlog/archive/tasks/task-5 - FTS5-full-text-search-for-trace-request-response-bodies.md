---
id: TASK-5
title: FTS5 full-text search for trace request/response bodies
status: To Do
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-09-21 09:53'
labels:
  - perf
  - p1
dependencies: []
references:
  - packages/db/src/index.ts
  - packages/db/src/migrations.ts
modified_files:
  - packages/db/src/index.ts
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trace body search still uses LIKE. Add FTS5 with versioned creation/backfill, ongoing synchronization, and matching search behavior without blocking normal ingest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 FTS5 virtual table covers request_body, response_body, input, output
- [ ] #2 Existing rows are backfilled once through a versioned migration; equal row counts are not treated as proof of index synchronization.
- [ ] #3 AFTER INSERT/UPDATE/DELETE triggers keep the FTS table in sync
- [ ] #4 q= filter on /api/traces uses MATCH; sub-100ms on 10k+ rows locally
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use the existing migration runner to create and backfill FTS once for existing rows. Keep the index synchronized on insert/delete and retention; do not infer synchronization from row-count equality. Verify body updates, deletions, restart behavior, query plans and search results.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: FTS5 is not implemented. Backfill must use an explicit migration rather than equal row counts as a correctness check.

2026-09-21 product-scope pruning: FTS5, backfill and synchronization machinery are premature without a reproducible search latency problem. LIKE is sufficient until a realistic dataset demonstrates otherwise.
<!-- SECTION:NOTES:END -->
