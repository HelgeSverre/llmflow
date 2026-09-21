---
id: TASK-44
title: Preserve unknown OTLP duration instead of inventing zero
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:48'
labels:
  - bug
  - ingestion
dependencies: []
references:
  - packages/otlp/src/traces.js
  - packages/db/src/index.ts
  - apps/server/src/server.ts
  - apps/dashboard/src/lib/trace/tree.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
OTLP transformation stores zero duration for missing, malformed or reversed timestamps, although the DB and UI distinguish unknown duration from an instantaneous span. A real missing-end-time payload returned duration zero and an invented end time equal to start time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Missing, invalid or reversed timestamp pairs preserve unknown duration through persistence and API/UI presentation.
- [x] #2 Valid equal timestamps remain a real zero duration, and normal valid intervals retain their measured duration.
- [x] #3 OTLP regressions cover missing, malformed, reversed, equal and normal timestamp pairs; tree summaries do not fabricate a measured end time from an unknown duration.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Preserve the actual API/database values through the relevant boundary; add focused ingestion and browser assertions for correlation, missing timing and real zeros.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 3. Correct stored and displayed data; overall position 10. See doc-4. This is scheduling order, not an artificial implementation dependency.

Missing, invalid and reversed OTLP timestamp pairs retain null duration. Equal timestamps remain measured zero; trace-tree summaries preserve unknown timing. Backend and browser regressions cover the distinction.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Missing, invalid and reversed OTLP timestamp pairs retain null duration. Equal timestamps remain measured zero; trace-tree summaries preserve unknown timing. Backend and browser regressions cover the distinction.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
