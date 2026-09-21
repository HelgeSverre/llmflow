---
id: TASK-29
title: Make metric summary cards obey the selected filters
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 09:55'
updated_date: '2026-09-21 11:48'
labels:
  - bug
  - dashboard
dependencies: []
references:
  - apps/dashboard/src/lib/stores/metrics.svelte.ts
  - apps/dashboard/src/lib/components/metrics/MetricsTab.svelte
  - apps/server/src/server.ts
  - packages/db/src/index.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 1200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selecting metric name, service or type changes the table but leaves unrelated summary cards. loadMetricsSummary sends no filters, and the summary route calls getMetricsSummary({}). Apply the same filter selection to both views.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Changing any metric filter updates rows and cards to the same matching dataset.
- [x] #2 Clearing filters restores both views; empty results do not leave stale cards.
- [x] #3 A browser regression with multiple services/types asserts exact filtered cards and values.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Apply identical filters to metric list/summary, compute gauge means independent of encoding, and refresh filtered data on live events. Assert exact values and live behavior with OTLP browser fixtures.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 3. Correct stored and displayed data; overall position 12. See doc-4. This is scheduling order, not an artificial implementation dependency.

Metric summaries and rows now use identical name, service, type and date filters. Counts use the same filtering rules, and request generations prevent stale responses overwriting a newer selection. Browser tests cover combined and empty selections.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Metric summaries and rows now use identical name, service, type and date filters. Counts use the same filtering rules, and request generations prevent stale responses overwriting a newer selection. Browser tests cover combined and empty selections.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
