---
id: TASK-20
title: Replay a captured request from trace detail
status: Done
assignee:
  - '@codex'
created_date: '2026-05-27 02:24'
updated_date: '2026-09-21 11:48'
labels:
  - feature
dependencies: []
references:
  - apps/server/src/proxy.ts
  - apps/dashboard/src/lib/components/traces/TraceDetail.svelte
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
modified_files:
  - apps/server/src/server.ts
  - apps/dashboard/src/
  - packages/db/src/index.ts
priority: low
ordinal: 2200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let a user rerun a captured provider request while debugging without reconstructing it by hand. Start with a Replay action that uses the existing provider configuration and opens the resulting trace. This is an optional product feature after correctness and readability fixes, not a prerequisite platform project.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A supported captured request can be replayed from trace detail and the new result is opened as a separate trace.
- [x] #2 Replay uses existing configured provider credentials; missing credentials or incomplete captured bodies produce a clear actionable message.
- [x] #3 Streaming requests use the existing forwarding path and the original trace remains unchanged.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope with existing stream, export, and proxy paths. Verify with local fixture providers/collectors and focused regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open. Replaced deleted forwarding helper assumptions; replay must supply fresh header or query credentials as appropriate.

2026-09-21 product-scope pruning: narrowed to a user-visible outcome; no prerequisite architecture, security, or test-organization project.

Execution sequence: 6. Reliability and optional replay; overall position 22. See doc-4. This is scheduling order, not an artificial implementation dependency.

Trace detail now replays supported normalized proxy POST requests using configured provider credentials and opens a separate captured result. Streaming uses the existing forwarding path. Missing credentials, incomplete bodies, native passthrough and redacted URL parameters return actionable messages. Local provider backend/browser tests verify fresh credentials, streamed results and an unchanged original trace; README documents scope.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Trace detail now replays supported normalized proxy POST requests using configured provider credentials and opens a separate captured result. Streaming uses the existing forwarding path. Missing credentials, incomplete bodies, native passthrough and redacted URL parameters return actionable messages. Local provider backend/browser tests verify fresh credentials, streamed results and an unchanged original trace; README documents scope.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
