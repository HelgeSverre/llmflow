---
id: TASK-47
title: Fix Traces and Logs search and request lifecycle cleanup
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 12:17'
updated_date: '2026-09-21 12:20'
labels: []
dependencies: []
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the adversarial review follow-ups: a pure cancellable search debounce shared by the three search tabs, stale-response guards for Logs, and Logs subscription cleanup. Keep request counters and fetch ownership local.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clear and component teardown cancel pending search in Traces, Logs and Timeline.
- [x] #2 Obsolete Logs list or detail responses cannot overwrite the latest filter or selection, including deselection and errors.
- [x] #3 Logs teardown unsubscribes live updates and invalidates pending requests; current live updates still work.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the explicitly approved narrow lifecycle fixes: schedule/cancel-only debounce used by search tabs; local generation guards for Logs list/selection; cleanup return from Logs live subscription. Add deferred-response, timer, teardown and browser Clear regressions. Rebuild/typecheck and commit the verified follow-up.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a pure schedule/cancel debounce shared by Traces, Logs and Timeline; Clear and unmount cancel pending work. Logs now ignores obsolete list/detail responses, invalidates detail on deselection and returns subscription cleanup that also invalidates in-flight results. Verified source diff, 39 dashboard unit tests, 29 targeted Playwright tests, workspace typecheck and rebuilt dashboard assets.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed pending search reappearing after Clear in Traces and Logs. Search tabs share only timer scheduling/cancellation while retaining their own filter/fetch behavior. Logs list and selection now ignore stale responses and release the live subscription on teardown.

Validation: 39 dashboard unit tests passed, including debounce rescheduling/cancellation, actual component unmounts, stale success/error responses, deselection and subscription cleanup. All 29 targeted browser tests passed. Workspace typecheck and dashboard build passed; shipped assets rebuilt.
<!-- SECTION:FINAL_SUMMARY:END -->
