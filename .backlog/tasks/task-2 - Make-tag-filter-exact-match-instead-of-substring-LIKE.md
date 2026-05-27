---
id: TASK-2
title: Make tag filter exact-match instead of substring LIKE
status: Done
assignee: []
created_date: '2026-05-27 02:20'
updated_date: '2026-05-27 04:11'
labels:
  - bug
  - p1
dependencies: []
references:
  - 'packages/db/src/index.ts:538'
  - 'todos.md:82'
modified_files:
  - packages/db/src/index.ts
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tag filter does 'tags LIKE $tag' on the serialized JSON tags column, so tag=foo also matches foobar, foo-bar, etc. Real false positives in production. Fix with either a trace_tags join table or json_each(tags) WHERE value = $tag.
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced tags LIKE $tag with EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = $tag) in packages/db/src/index.ts:538. No schema migration needed (tags already stored as JSON array). Verified: 'foo' no longer matches 'foobar'.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
<!-- DOD:END -->
