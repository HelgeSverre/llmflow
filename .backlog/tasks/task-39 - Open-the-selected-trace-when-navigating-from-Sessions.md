---
id: TASK-39
title: Open the selected trace when navigating from Sessions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:48'
labels:
  - bug
  - dashboard
dependencies: []
references:
  - apps/dashboard/src/lib/components/sessions/SessionsTab.svelte
  - apps/dashboard/src/lib/components/sessions/SessionDetail.svelte
  - apps/dashboard/src/lib/stores/tabs.svelte.ts
  - apps/dashboard/src/lib/stores/traces.svelte.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 800
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Session trace clicks write #traces?trace=<id>, but the hash parser accepts only exact tab names and no code consumes the trace parameter. Chromium lands on Timeline with no selected trace.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a session trace opens Traces and selects the requested root span, including when span ID and trace ID differ.
- [x] #2 Navigation uses a supported URL/state contract and does not fall back to Timeline.
- [x] #3 A browser regression starts in a real session detail, clicks a trace and asserts the active tab and selected span.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use canonical tab state and explicitly select the session root span; verify cross-tab navigation with distinct trace/span IDs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 2. Broken screens and navigation; overall position 8. See doc-4. This is scheduling order, not an artificial implementation dependency.

Session trace links now switch to the canonical Traces tab and explicitly load the selected root span. A browser regression with distinct session, trace and span IDs verifies the selected tree.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Session trace links now switch to the canonical Traces tab and explicitly load the selected root span. A browser regression with distinct session, trace and span IDs verifies the selected tree.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
