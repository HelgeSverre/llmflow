---
id: TASK-55
title: Give trace and log lists useful space before and after selection
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
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D01 (reviewed commit 93a8d42).

At 1440px, eight trace columns occupy roughly 456px while an unselected inspector consumes the rest. Logs has the same wasted split. Make the primary content readable in both selection states.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/traces.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unselected Traces and Logs use the available width without an empty inspector consuming most of it.
- [x] #2 At 1280px and 1440px, essential name/message and status information stays readable without default horizontal scrolling.
- [x] #3 Selection opens useful details with a compact name-first list and an explicit close/back action that preserves filters and position.
- [x] #4 User-resized pane widths remain usable; browser screenshots verify selected and unselected layouts in both themes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use full-width unselected lists and compact selected records with explicit return controls, preserving filters and scroll position.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Traces and Logs use full-width unselected lists and compact name/message-first records during inspection. A shared investigation layout restores list scroll position on Back and retains resized pane widths; unselected lists expand to full width again.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
