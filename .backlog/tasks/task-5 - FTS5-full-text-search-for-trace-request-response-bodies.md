---
id: TASK-5
title: FTS5 full-text search for trace request/response bodies
status: To Do
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-05-27 02:24'
labels:
  - perf
  - p1
dependencies:
  - TASK-8
references:
  - 'packages/db/src/index.ts:492'
  - 'todos.md:85'
modified_files:
  - packages/db/src/index.ts
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The q= filter expands to (request_body LIKE %q% OR response_body LIKE %q% OR input LIKE %q% OR output LIKE %q%) — full table scan on every search. Add an FTS5 virtual table over those four columns and rewrite the q filter to MATCH.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 FTS5 virtual table covers request_body, response_body, input, output
- [ ] #2 Existing rows backfilled on first boot when FTS row count differs from traces row count
- [ ] #3 AFTER INSERT/UPDATE/DELETE triggers keep the FTS table in sync
- [ ] #4 q= filter on /api/traces uses MATCH; sub-100ms on 10k+ rows locally
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use traces_fts with content='traces', content_rowid='rowid' (external content mode — no storage duplication). Triggers fire only on indexed columns. Backfill in a single transaction. Land after the migrations runner so the FTS setup is a registered migration.
<!-- SECTION:PLAN:END -->
