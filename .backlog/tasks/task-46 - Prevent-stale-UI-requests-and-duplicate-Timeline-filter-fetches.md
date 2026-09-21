---
id: TASK-46
title: Prevent stale UI requests and duplicate Timeline filter fetches
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 12:02'
updated_date: '2026-09-21 12:04'
labels: []
dependencies: []
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the three reviewed follow-ups: cancel pending Timeline search on Clear, ignore obsolete session detail responses, and use one reactive owner for filter fetches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clearing Timeline search cancels pending debounced queries.
- [x] #2 Only the newest session detail request can update selection, error and loading state.
- [x] #3 Each Timeline filter change sends one request; live and manual refresh still work.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the three explicitly approved fixes locally: cancel Clear debounce, remove handler/store filter reloads in favor of the effect, and guard session detail state with a request counter. Verify delayed-response ordering with unit tests and filter request counts/Clear in Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cancelled pending Timeline search on Clear and removed redundant filter-handler/store fetch calls. Added a session-detail request generation guard for success, failure and loading updates. Verified 28 dashboard unit tests, 19 existing targeted browser tests plus the new deterministic request-count/Clear regression, workspace typecheck, and dashboard build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Timeline filter changes now fetch once through the reactive effect, and Clear cancels pending search updates. Session detail ignores obsolete success/failure responses and cannot clear loading for a newer detail request.

Validation: 28 dashboard unit tests passed, including nine deferred-response session cases; 20 targeted browser tests passed after correcting the test clock fixture; workspace typecheck and dashboard build passed. Rebuilt shipped dashboard assets.
<!-- SECTION:FINAL_SUMMARY:END -->
