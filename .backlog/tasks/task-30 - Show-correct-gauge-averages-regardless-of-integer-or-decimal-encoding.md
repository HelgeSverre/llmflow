---
id: TASK-30
title: Show correct gauge averages regardless of integer or decimal encoding
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
  - packages/db/src/index.ts
  - apps/dashboard/src/lib/components/metrics/MetricsSummary.svelte
  - apps/dashboard/src/lib/stores/metrics.svelte.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 1300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SUM(value_int) versus AVG(value_double) makes integer gauge samples 10 and 20 display Total 30, while the same samples encoded as doubles display Average 15. Compute the gauge average across both numeric columns and label it explicitly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Gauge samples 10 and 20 display Average 15 for integer, double and mixed encoding.
- [x] #2 Zero remains visible and missing samples do not become fabricated zeros.
- [x] #3 Histogram count/sum presentation remains correct; focused API/browser assertions cover the gauge encoding mismatch.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Apply identical filters to metric list/summary, compute gauge means independent of encoding, and refresh filtered data on live events. Assert exact values and live behavior with OTLP browser fixtures.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 3. Correct stored and displayed data; overall position 13. See doc-4. This is scheduling order, not an artificial implementation dependency.

Gauge averages now include integer and decimal encodings in the same aggregate. Sum and histogram observation cards keep their separate semantics. Backend and browser tests cover integer, decimal, mixed, zero and missing values.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gauge averages now include integer and decimal encodings in the same aggregate. Sum and histogram observation cards keep their separate semantics. Backend and browser tests cover integer, decimal, mixed, zero and missing values.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
