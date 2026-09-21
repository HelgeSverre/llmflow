---
id: TASK-40
title: Update the Metrics view when live metric events arrive
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
  - apps/dashboard/src/lib/stores/metrics.svelte.ts
  - apps/dashboard/src/lib/components/metrics/MetricsTab.svelte
  - apps/server/src/server.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: medium
ordinal: 1400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The server broadcasts new_metric but the Metrics store has no subscription. Chromium receives the event while its table stays at eight rows; manual refresh reveals the ninth. Subscribe using the existing live-update pattern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A newly ingested matching metric appears in the open Metrics view without manual refresh or tab switching.
- [x] #2 Both list and summary refresh while respecting active filters; nonmatching data does not leak into the selection.
- [x] #3 Subscriptions are cleaned up and bursts do not cause one unnecessary fetch per record; a browser regression verifies the actual live row/value.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Apply identical filters to metric list/summary, compute gauge means independent of encoding, and refresh filtered data on live events. Assert exact values and live behavior with OTLP browser fixtures.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 3. Correct stored and displayed data; overall position 14. See doc-4. This is scheduling order, not an artificial implementation dependency.

Metrics subscribes to live metric events while active, coalesces bursts, reloads filtered rows/cards/options and cleans up its subscription. Browser test verifies a live zero-valued gauge appears without manual refresh and unrelated services stay excluded.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Metrics subscribes to live metric events while active, coalesces bursts, reloads filtered rows/cards/options and cleans up its subscription. Browser test verifies a live zero-valued gauge appears without manual refresh and unrelated services stay excluded.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
