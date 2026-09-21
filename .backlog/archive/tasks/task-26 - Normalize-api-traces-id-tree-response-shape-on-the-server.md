---
id: TASK-26
title: 'Normalize /api/traces/:id/tree response shape on the server'
status: To Do
assignee: []
created_date: '2026-05-27 15:59'
updated_date: '2026-09-21 09:42'
labels:
  - server
  - api
  - refactor
dependencies: []
references:
  - apps/dashboard/src/lib/trace/tree.ts
  - apps/dashboard/src/lib/stores/traces.svelte.ts
  - e2e/playwright/trace-waterfall.spec.js
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Superseded design proposal: a flat /api/traces/:id/tree response was considered to suit the viewport. The existing nested tree contract is now explicitly typed and normalized by the shared dashboard tree adapter, with descendant rendering and waterfall regression coverage. Changing the endpoint is no longer required to resolve the original UI problem.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /api/traces/:id/tree returns spans as a flat array keyed by parent_id
- [ ] #2 Each span has start_time (not timestamp), name (not span_name), end_time (computed)
- [ ] #3 TraceDetail.svelte adapter shrinks to a near-passthrough (or removed entirely)
- [ ] #4 OTLP e2e tests still pass; dashboard waterfall still renders identically
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task 27 resolves GitHub #31 using a typed adapter for the existing nested API response. The nested endpoint remains compatible and all descendants render. This proposed flat server API redesign is not required and has not been implemented.

2026-09-21 reconciliation: Archived as superseded, not completed: the proposed flat server response was deliberately not implemented. The shared typed adapter is an intentional boundary, not an obsolete fallback.
<!-- SECTION:NOTES:END -->
