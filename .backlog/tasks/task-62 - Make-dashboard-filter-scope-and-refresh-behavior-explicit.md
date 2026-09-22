---
id: TASK-62
title: Make dashboard filter scope and refresh behavior explicit
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
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D12 (reviewed commit 93a8d42).

Service controls vary between exact text and selectors, Sessions lacks search, refresh is mostly undiscoverable, and header totals do not state their scope. Improve existing filter workflows and make any required API extension explicit.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/metrics.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Relevant filter toolbars have consistent labels, service selection behavior, Clear filters and accurate visible result counts.
- [x] #2 Sessions can be searched by useful session identity across the dataset, not just the displayed page.
- [x] #3 Global header totals state their scope and distinguish trace groups from spans; view-level filters remain explicitly local.
- [x] #4 Refresh/live state is discoverable where appropriate, and browser tests verify clearing, refreshing and pagination with filters.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Label filter scopes and result counts, add dataset-wide session search, consistent service controls and discoverable refresh.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Filters have clear accessible names, captured-service selectors, Clear actions and displayed-result scope. Session search covers matching identity across every page. Header totals explicitly cover all retained spans, while view controls expose refresh/live behavior.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
