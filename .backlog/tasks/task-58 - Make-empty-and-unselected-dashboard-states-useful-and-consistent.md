---
id: TASK-58
title: Make empty and unselected dashboard states useful and consistent
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 13:53'
updated_date: '2026-09-22 09:16'
labels:
  - ui
  - design-review
dependencies:
  - TASK-51
references:
  - e2e/playwright/design-sweep.spec.js
documentation:
  - docs/guides/dashboard.md
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D03 (reviewed commit 93a8d42).

Sessions displays disabled pagination above an empty table; Logs renders empty payload sections before selection. Distinguish genuine emptiness, filtered-out results and no selection; request failures are handled by the request-state task.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/sessions.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Genuine empty datasets explain the relevant next step, including how session correlation produces Sessions.
- [x] #2 Filtered zero-result states offer a clear way to remove filters.
- [x] #3 Unselected detail panels use one helpful instruction rather than blank BODY/ATTRIBUTES/RESOURCE values.
- [x] #4 Meaningless pagination and empty table headers are absent when no records exist; browser checks cover these states.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Align empty, filtered and unselected states with request-state feedback and useful recovery/setup instructions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Empty lists explain ingestion or session correlation, filtered empty states offer Clear filters, and empty tables and session paging are hidden. Unselected investigation views show a single selection hint instead of blank payload sections.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
