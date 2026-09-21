---
id: TASK-31
title: Show related logs for timeline traces with distinct span and trace IDs
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
  - apps/dashboard/src/lib/stores/timeline.svelte.ts
  - apps/server/src/server.ts
  - e2e/playwright/timeline.spec.js
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 1500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
selectTimelineItem queries logs by the selected row ID instead of the actual trace_id. An ordinary OTLP span can show no related logs despite matching logs existing. Use the trace correlation ID from the loaded detail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting an OTLP record whose row ID differs from trace_id shows logs sharing its trace_id.
- [x] #2 Unrelated logs are excluded; records without a correlation ID do not trigger a misleading lookup.
- [x] #3 A browser regression ingests distinct span/trace IDs and a matching log, then verifies the log appears.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope using existing API and detail components; add focused browser regressions and verify typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 4. Reach and filter existing records; overall position 15. See doc-4. This is scheduling order, not an artificial implementation dependency.

Single-span detail exposes its actual trace_id; Timeline uses that correlation ID for related logs and guards against stale selection responses. Browser ingestion with distinct OTLP trace/span IDs verifies the matching log.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Single-span detail exposes its actual trace_id; Timeline uses that correlation ID for related logs and guards against stale selection responses. Browser ingestion with distinct OTLP trace/span IDs verifies the matching log.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
