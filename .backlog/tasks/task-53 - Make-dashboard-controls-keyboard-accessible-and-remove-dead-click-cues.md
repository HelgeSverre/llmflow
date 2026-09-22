---
id: TASK-53
title: Make dashboard controls keyboard-accessible and remove dead click cues
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
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D10 (reviewed commit 93a8d42).

Metric rows advertise clicks without doing anything; Sessions rows require a mouse; navigation and filter controls lack consistent accessible state and names.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/metric-before.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Metric rows without an action no longer show pointer/interactive hover styling or receive ineffective keyboard navigation.
- [x] #2 Session rows expose native links or buttons usable with keyboard focus and activation.
- [x] #3 Primary navigation exposes the current view and interactive controls have meaningful accessible names and visible focus.
- [x] #4 Keyboard-only browser checks complete the session-to-trace workflow and verify filter labels without introducing a widget framework.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use native session actions, label navigation and filters, remove dead metric row controls, and verify keyboard navigation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Session entries use native keyboard buttons, navigation exposes its current view, controls have accessible names and visible focus, and metric rows no longer imply a nonexistent click or keyboard action.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
