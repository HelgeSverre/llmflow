---
id: TASK-48
title: Repair provider capture and Cohere response handling from E2E review
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 13:16'
updated_date: '2026-09-21 13:35'
labels: []
dependencies: []
references:
  - apps/server/test/stream-formats.test.ts
  - apps/server/test/proxy-regressions.test.ts
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Real Pi Responses tool calls were missing from recorded responses, Cohere normalization discarded HTTP error messages, and Cohere streams emitted duplicate DONE markers. Preserve capture and client-visible response semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Responses streaming preserves function call IDs, names, arguments and completion status
- [x] #2 Cohere errors preserve upstream error details and status
- [x] #3 Cohere streaming emits one DONE marker
- [x] #4 Provider regression tests and real agent capture verify the fixes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Extend bounded Responses capture for tool events and terminal status; preserve non-success Cohere payloads; emit one terminal SSE marker; add targeted regressions and verify real Pi traffic.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added bounded Responses tool-event capture and final snapshot reconciliation, preserved upstream HTTP errors, and made terminal SSE emission idempotent. Full server suite passed; real Pi tool-use persisted read/fixture.txt with call ID, usage and tool_calls termination. Real Cohere success/error/stream checks passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed missing Responses tool capture, preserved provider HTTP errors and removed duplicate Cohere DONE markers. Final tool snapshots replace partial arguments while retaining bounded capture.

Validation: full server suite and targeted stream/proxy regressions passed. Real Pi Responses read-tool loop persisted the call ID, complete fixture arguments, usage and tool_calls finish reason. Real Cohere success, error and streaming checks passed.

![Pi tool capture](assets/images/qa-responses-tool-fixed.png)
<!-- SECTION:FINAL_SUMMARY:END -->
