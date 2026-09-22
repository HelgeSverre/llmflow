---
id: TASK-61
title: Standardize value formatting and repair session theme styling
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
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D11 (reviewed commit 93a8d42).

Cost precision, token formatting and time styles vary across tabs; Sessions uses undefined CSS variables. Adopt context-appropriate formatting and existing theme tokens without a broad component refactor.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/sessions-populated.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overview lists use consistent compact values and detail views preserve exact tokens and useful small-cost precision.
- [x] #2 Timestamps use a consistent documented timezone/display convention with precise values available in detail.
- [x] #3 Missing values remain distinct from zero and small nonzero cost never becomes a misleading zero.
- [x] #4 Session borders, hover and monospace styling use defined theme values and are visually checked in both themes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Share context-appropriate cost/time/token formatting and replace undefined session theme variables; verify both themes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Overview lists share compact formatting; details preserve exact token counts and useful micro-cost precision. Precise timestamps include the browser timezone, and the dashboard guide documents local timestamps versus UTC daily analytics. Session styling uses defined theme values.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
