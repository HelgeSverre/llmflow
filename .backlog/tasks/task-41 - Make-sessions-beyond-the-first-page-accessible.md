---
id: TASK-41
title: Make sessions beyond the first page accessible
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:48'
labels:
  - bug
  - dashboard
dependencies: []
references:
  - apps/dashboard/src/lib/stores/sessions.svelte.ts
  - apps/dashboard/src/lib/components/sessions/SessionList.svelte
  - apps/dashboard/src/lib/components/sessions/SessionsTab.svelte
  - apps/server/src/server.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: medium
ordinal: 1700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sessions API supports limit/offset and returns total, but the UI only displays its first 50 records with no paging control. Reproduction with 52 sessions returns API total 52 but only 50 reachable UI rows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can reach every session through pagination or load more using the existing API.
- [x] #2 Paging boundaries use the returned total; empty lists and the final partial page behave correctly.
- [x] #3 A browser regression with more than 50 sessions opens a session beyond the first page without omissions or duplicate rows.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope using existing API and detail components; add focused browser regressions and verify typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 4. Reach and filter existing records; overall position 17. See doc-4. This is scheduling order, not an artificial implementation dependency.

Sessions now exposes Previous/Next controls, current bounds and total count through the existing limit/offset API. Browser regression creates 52 sessions, compares the second page with API results and opens an older session.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sessions now exposes Previous/Next controls, current bounds and total count through the existing limit/offset API. Browser regression creates 52 sessions, compares the second page with API results and opens an older session.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
