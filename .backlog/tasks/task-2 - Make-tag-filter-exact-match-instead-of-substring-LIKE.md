---
id: TASK-2
title: Make tag filter exact-match instead of substring LIKE
status: Done
assignee: []
created_date: '2026-05-27 02:20'
updated_date: '2026-09-21 09:42'
labels:
  - bug
  - p1
dependencies: []
references:
  - packages/db/src/index.ts
modified_files:
  - packages/db/src/index.ts
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Exact tag filtering uses json_each over stored tag arrays rather than substring LIKE matching, so similarly named tags do not match each other.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 tag=foo matches only the exact 'foo' tag, never substrings
- [x] #2 Existing rows remain searchable without backfill
- [x] #3 Other tag-related queries (if any) keep working
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Prefer json_each(tags) WHERE value = $tag — single-row scan, no schema migration, bun:sqlite ships json1. Indexed trace_tags table is the alternative if perf demands it later.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Existing exact-match implementation retained; removed obsolete todos.md and line-number references.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced tags LIKE $tag with EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = $tag) in packages/db/src/index.ts:538. No schema migration needed (tags already stored as JSON array). Verified: 'foo' no longer matches 'foobar'.
<!-- SECTION:FINAL_SUMMARY:END -->
