---
id: TASK-63
title: Make model and metric summaries interpretable and actionable
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
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D04 (reviewed commit 93a8d42).

Model cards have no sorting or path to matching requests; metric values omit API-provided units and their scope is unclear. Add useful investigation actions, with API changes scoped to supporting those outcomes.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/models.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Model summaries support useful cost/request sorting and show the selected time scope.
- [x] #2 View traces opens the corresponding model and time-filtered requests.
- [x] #3 Metric cards and rows show supplied units and aggregation/time scope; unknown units are not invented.
- [x] #4 A metric-series action narrows to its matching measurements using existing filters or a minimal useful detail view.
- [x] #5 Browser checks verify units, model drill-down and consistent scope between aggregate and matching records.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add scoped model sorting/drill-down and explicit metric units/aggregation with series filtering; verify API/UI agreement.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Models support time scoping and request/cost sorting, with View traces reusing the exact successful aggregate window. Metric cards and rows expose units and aggregation scope, and View measurements applies the matching series filters. API/browser values agree in fixtures.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
