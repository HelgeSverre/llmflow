---
id: TASK-49
title: Repair dashboard live updates search and detail failures from E2E review
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 13:16'
updated_date: '2026-09-21 13:35'
labels: []
dependencies: []
references:
  - e2e/playwright/qa-fixes.spec.js
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
E2E testing found live Logs ignoring severity or dropping searched arrivals, a blank severity label, stale Sessions, span-name search mismatches, and Timeline detail requests stuck loading. Restore consistent filtering, fresh data and recoverable errors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Live logs obey severity and text search and severity labels remain visible
- [x] #2 Sessions refresh on activation and reflect incoming session spans
- [x] #3 Trace search finds span names while preserving body search and other filters
- [x] #4 Timeline detail failures show an error and retry action without stale selection races
- [x] #5 Browser regression tests verify all six UI findings
- [x] #6 Activating Logs refreshes service and event filter options created while another tab was active
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Refresh filtered logs from canonical API queries; retain severity string values; refresh sessions on activation and span events with stale-request protection; include names in trace search; show retryable Timeline errors; add browser regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Canonical filtered log refresh, session activation/live refresh, pending pagination preservation, expanded trace search and retryable Timeline errors implemented. Browser regressions and 40 dashboard unit tests pass.

Manual screenshot walkthrough found stale log service options after off-tab ingestion. Extended activation refresh and browser coverage before completion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed all six dashboard findings: live log severity and search behavior, severity labels, stale Sessions, span-name search and Timeline detail error recovery. Also refreshes log filter options on activation and preserves pending session pagination during live updates.

Validation: 103 browser tests passed; focused regressions and session pagination reran successfully after final changes. All 40 dashboard unit tests and workspace typechecks passed. Browser walkthrough confirmed visible error/retry recovery and filtered live arrival.

![Live filters](assets/images/qa-live-log-filters.png)
![Timeline Retry](assets/images/qa-timeline-retry.png)
![Recovered detail](assets/images/qa-timeline-recovered.png)
<!-- SECTION:FINAL_SUMMARY:END -->
