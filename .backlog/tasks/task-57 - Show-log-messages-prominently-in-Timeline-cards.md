---
id: TASK-57
title: Show log messages prominently in Timeline cards
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
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D02 (reviewed commit 93a8d42).

Timeline cards use event names as titles and repeat the service in subtitle and badge, hiding the message that differentiates otherwise identical events.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/timeline.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Log cards display a useful body preview as their primary content, with event name as secondary metadata.
- [x] #2 Service appears once and severity and timestamp remain easy to scan.
- [x] #3 Missing, structured and long bodies remain readable without breaking the list layout.
- [x] #4 Browser fixtures with identical event/service names and different bodies can be distinguished without opening details.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use message-first Timeline log previews and show service once; verify structured, missing and long bodies.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Timeline logs use body previews as their primary content, event names as secondary metadata, and one service badge. Long previews are bounded to three lines; missing and structured bodies have usable representations. Fixtures distinguish messages sharing the same event and service.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
