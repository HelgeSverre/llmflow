---
id: TASK-42
title: Filter Timeline by actual captured service names
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
  - apps/dashboard/src/lib/components/timeline/TimelineTab.svelte
  - apps/dashboard/src/lib/stores/timeline.svelte.ts
  - apps/server/src/server.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: medium
ordinal: 1600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Timeline offers five hardcoded tool names but the server filters their values against arbitrary service_name. A captured service such as my-agent cannot be selected and every offered choice may be empty.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Timeline can filter an arbitrary captured service name using actual service options or a text filter.
- [x] #2 The control label describes the field it filters and clearing it restores the unfiltered list.
- [x] #3 A browser regression with non-hardcoded service names verifies exact matching for the supported Timeline item types.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope using existing API and detail components; add focused browser regressions and verify typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 4. Reach and filter existing records; overall position 16. See doc-4. This is scheduling order, not an artificial implementation dependency.

Replaced hardcoded tool choices with an exact service-name text filter, updated its label and guide, and retained clear-to-reset behavior. Browser test verifies arbitrary service names across trace and log rows.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced hardcoded tool choices with an exact service-name text filter, updated its label and guide, and retained clear-to-reset behavior. Browser test verifies arbitrary service names across trace and log rows.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
