---
id: TASK-59
title: Make Sessions navigable by trace names and failure context
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
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design sweep D05 (reviewed commit 93a8d42).

Session titles and rows emphasize UUIDs and truncated trace IDs instead of the investigation name. Improve session identity, trace rows and access to failures; expose required metadata through the API if needed.

See doc-5 for evidence, context and the delivery sequence.

![Review evidence](assets/design-sweep-2026-09-21/session-detail.png)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Session headings and trace rows prioritize available human-readable agent/service/root-span names over opaque IDs.
- [x] #2 Full IDs remain available secondarily with a working Copy action.
- [x] #3 Summary labels use correct singular/plural forms and identify spans, traces, tokens, costs and errors clearly.
- [x] #4 An error action opens the relevant failing span rather than requiring ID guessing; browser coverage verifies a multi-span session.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Expose session display names and failed-span identity through the API; add meaningful rows, summaries and copy actions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the recorded UI/API changes. Server suite, dashboard unit tests and typechecks pass. Browser coverage is exercising request failures, exact-span navigation, session search, model scope, metric units, and responsive screenshots; final regression run and visual refinements are in progress.

Final verification complete. Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Session headings and trace entries prioritize root names and service context, retain full IDs with Copy actions, and use correct summary plurals. The session API returns the relevant failed-span ID for direct keyboard-accessible navigation.

Validation: 125 Playwright tests passed, 40 dashboard unit tests passed, the complete server suite passed, all workspace typechecks passed with zero Svelte diagnostics, and formatting/diff checks passed. Reviewed the source diff and local browser screenshots in both themes. No external provider calls were needed; replay used the isolated local fixture.

Browser evidence: assets/design-fixes-2026-09-22/. Dashboard conventions: docs/guides/dashboard.md.
<!-- SECTION:FINAL_SUMMARY:END -->
