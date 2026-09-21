---
id: TASK-1
title: Bound capture memory for tool-heavy streaming responses
status: Done
assignee:
  - '@codex'
created_date: '2026-05-27 02:20'
updated_date: '2026-09-21 11:48'
labels:
  - perf
  - p1
dependencies: []
references:
  - packages/providers/src/stream.ts
  - apps/server/src/proxy.ts
  - apps/server/test/proxy-regressions.test.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
modified_files:
  - apps/server/src/server.ts
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
StreamSession retains a tools map and toolIndices map for the entire response. Individual argument limits do not bound total retained tool calls. Long tool-heavy generations can therefore grow capture memory even after text capture reaches its limit. Fix the aggregate capture path without changing what the caller receives.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Total retained tool metadata and arguments have a bounded per-stream capture budget, including index bookkeeping.
- [x] #2 Exceeding the capture budget still forwards the full provider response and preserves final usage/pricing.
- [x] #3 The stored trace clearly indicates incomplete capture; a regression using many distinct tool calls verifies bounded capture and unchanged forwarding.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope with existing stream, export, and proxy paths. Verify with local fixture providers/collectors and focused regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Criteria 1–3 are implemented. Criterion 4 remains open because tools/toolIndices can grow with distinct tool calls; do not equate individual field limits with a total memory bound.

2026-09-21 product-scope pruning: narrowed to a user-visible outcome; no prerequisite architecture, security, or test-organization project.

Execution sequence: 6. Reliability and optional replay; overall position 20. See doc-4. This is scheduling order, not an artificial implementation dependency.

Bounded retained tool capture to an aggregate 2 MiB character budget and 1,024 entries, plus constant-size Anthropic block-index tracking. Forwarded events remain complete, final usage/pricing is preserved, and stored responses carry _truncated when capture is incomplete. Regressions exercise 3,000 OpenAI calls, 1,500 Anthropic blocks and a stored truncated replay.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bounded retained tool capture to an aggregate 2 MiB character budget and 1,024 entries, plus constant-size Anthropic block-index tracking. Forwarded events remain complete, final usage/pricing is preserved, and stored responses carry _truncated when capture is incomplete. Regressions exercise 3,000 OpenAI calls, 1,500 Anthropic blocks and a stored truncated replay.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
