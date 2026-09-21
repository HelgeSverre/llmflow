---
id: TASK-23
title: >-
  Fix dashboard layout overflow — entire page scrolls because .container is not
  viewport-bounded
status: Done
assignee:
  - '@codex'
created_date: '2026-05-27 15:59'
updated_date: '2026-09-21 09:42'
labels:
  - dashboard
  - layout
  - bug
dependencies: []
references:
  - apps/dashboard/src/app.css
  - apps/dashboard/src/lib/components/trace-viewer/SpanWaterfall.svelte
  - e2e/playwright/trace-waterfall.spec.js
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dashboard layout is bounded to the viewport. Long trace trees, detail content and tables scroll inside their panels rather than expanding the document. This task covers layout containment, not every data-presentation enhancement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Page no longer scrolls vertically — document.body.scrollHeight equals window.innerHeight on every tab
- [x] #2 Clicking a trace row leaves detail panel visible without manual scroll
- [x] #3 Traces, Logs, Metrics, Models, Analytics tabs render correctly after fix (no regressions)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Bound the viewport flex chain, verify selection visibility and inspect all tabs at desktop and narrow widths.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Completed containment remains covered by all-tab browser assertions. Updated the description to reflect the fixed layout.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bound dashboard panels to the viewport and contain detail scrolling. Trace selection remains visible, with responsive stacked panels on narrow screens. Verified all tabs and nested trace detail at 1440, 1000 and 390 px, including light/dark screenshots, in the passing Playwright suite.
<!-- SECTION:FINAL_SUMMARY:END -->
