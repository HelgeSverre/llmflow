---
id: TASK-64
title: Make analytics charts readable and daily activity easy to inspect
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
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D06 (reviewed commit 93a8d42).

Token charts lack date/scale labels, model names truncate distinguishing suffixes, Daily Summary buries recent activity, and Cost by Tool is actually grouped by service/provider.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/analytics-light.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Token trends show useful date and numeric scale labels with an unambiguous token breakdown and accessible values beyond hover.
- [x] #2 Cost charts preserve distinguishable model/service names and label service/provider grouping truthfully.
- [x] #3 Daily Summary presents recent activity first without making users scroll past old zero-activity days.
- [x] #4 Charts remain understandable in light/dark themes and narrow windows; browser checks verify date/value correspondence and ordering.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Label chart axes and breakdowns, clarify service attribution and model names, and show recent daily activity first.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Analytics shows date and numeric scale labels, explains prompt as part of total tokens, and exposes exact daily token components beyond hover. Service/provider grouping is labeled accurately, distinguishing names wrap, and Daily Summary is newest-first.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
