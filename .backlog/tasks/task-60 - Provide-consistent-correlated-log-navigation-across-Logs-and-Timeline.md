---
id: TASK-60
title: Provide consistent correlated-log navigation across Logs and Timeline
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 13:53'
updated_date: '2026-09-22 09:16'
labels:
  - ui
  - design-review
dependencies: []
references:
  - e2e/playwright/design-sweep.spec.js
documentation:
  - docs/guides/dashboard.md
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D14 (reviewed commit 93a8d42).

Timeline offers Open trace for a correlated log while Logs shows only a truncated ID. Make correlation actions consistent and retain the source investigation context. Aggregate drill-down is scoped separately.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/correlated-log.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The same correlated log offers equivalent Open trace actions from Logs and Timeline.
- [x] #2 Navigation resolves the exact correlated span when available; missing correlation is handled without a broken action.
- [x] #3 Full correlation IDs can be copied, and known session context has a useful navigation action.
- [x] #4 Returning preserves source filters and selection; browser checks cover correlated and uncorrelated logs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reuse correlation actions for log details, resolve exact spans and known sessions, and preserve source-view state.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Logs and Timeline share correlated-log actions for opening the exact retained span, copying full IDs and opening known sessions. Missing or evicted correlation is explained without an enabled broken action. Returning to the source tab preserves filters and selection.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
