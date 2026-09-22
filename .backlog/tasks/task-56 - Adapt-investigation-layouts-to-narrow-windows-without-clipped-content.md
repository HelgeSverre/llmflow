---
id: TASK-56
title: Adapt investigation layouts to narrow windows without clipped content
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 13:53'
updated_date: '2026-09-22 09:16'
labels:
  - ui
  - design-review
dependencies:
  - TASK-55
references:
  - e2e/playwright/design-sweep.spec.js
documentation:
  - docs/guides/dashboard.md
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D07 (reviewed commit 93a8d42).

At 800px, desktop panes compress waterfall names; at 390px session detail clips status and retains an overflowing fixed grid. Build on the corrected desktop list/detail layout.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/session-390.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When pane widths become unusable, investigation views switch to list-to-detail navigation with a clear return action.
- [x] #2 At 800px and 390px, session status/actions and meaningful waterfall names remain accessible without clipped fixed-grid content.
- [x] #3 Returning to a list preserves selected record and filter context.
- [x] #4 Responsive browser verification covers Traces, Logs, Timeline and Sessions plus a desktop regression check.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Adapt list/detail and waterfall layouts to usable widths, wrap session metadata, and verify 800px and 390px views.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Investigation views switch from side-by-side panes to list/detail navigation below 900px. The waterfall reserves room for names and error badges on phones, and detail/session content wraps without page overflow. Traces, Logs, Timeline and Sessions were checked at 1440, 1280, 800 and 390 pixels.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
