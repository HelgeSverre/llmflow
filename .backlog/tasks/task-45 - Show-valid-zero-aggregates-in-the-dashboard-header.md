---
id: TASK-45
title: Show valid zero aggregates in the dashboard header
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:49'
labels:
  - bug
  - dashboard
dependencies: []
references:
  - apps/dashboard/src/lib/components/layout/Header.svelte
  - apps/dashboard/src/lib/stores/stats.svelte.ts
  - apps/dashboard/src/lib/utils/format.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: low
ordinal: 1100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Header positive-value checks display dashes for real zero-token, zero-cost and zero-latency aggregates. Other views now distinguish unknown from zero; the header still misrepresents the same data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A real zero-token, zero-cost, zero-duration trace produces visible zero values in the header.
- [x] #2 Unavailable values remain distinguishable from numeric zero without inventing measurements.
- [x] #3 A focused browser assertion checks the header values against the stats API for a zero-valued fixture.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Preserve the actual API/database values through the relevant boundary; add focused ingestion and browser assertions for correlation, missing timing and real zeros.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 3. Correct stored and displayed data; overall position 11. See doc-4. This is scheduling order, not an artificial implementation dependency.

Header formatters now display numeric zero as zero and retain null for unavailable initial stats. Browser assertions verify one recorded request with zero tokens, cost and latency.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Header formatters now display numeric zero as zero and retain null for unavailable initial stats. Browser assertions verify one recorded request with zero tokens, cost and latency.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
