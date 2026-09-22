---
id: TASK-54
title: Open useful trace details immediately and explain unavailable Replay
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
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D09 (reviewed commit 93a8d42).

Selecting a trace opens a tree with an empty inspector, and telemetry-only traces still expose an enabled Replay action. Improve the existing inspection workflow without changing replay capabilities.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/trace-detail.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a trace or span row automatically opens details for that exact span or its root as appropriate.
- [x] #2 Initial detail selection prefers useful available content over empty Attributes while respecting an explicitly selected valid subtab.
- [x] #3 Unsupported Replay actions are unavailable with an intelligible reason; supported replay keeps its execution consequences clear.
- [x] #4 Browser tests cover child/root selection, selection changes, telemetry-only requests and an eligible replay request.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Select useful span content automatically and expose backend replay eligibility with a reason; verify supported and unsupported actions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Trace navigation selects the exact requested span and opens populated captured content. Explicit populated detail tabs survive span changes. Replay availability and explanations use the same backend preflight as execution; local streaming replay remains covered.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
