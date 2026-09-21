---
id: TASK-9
title: Flush queued OTLP exports when stopping the local server
status: Done
assignee:
  - '@codex'
created_date: '2026-05-27 02:22'
updated_date: '2026-09-21 11:48'
labels:
  - reliability
  - p2
dependencies: []
references:
  - apps/server/src/server.ts
  - packages/otlp/src/export.js
  - bin/llmflow.js
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
modified_files:
  - apps/server/src/server.ts
priority: medium
ordinal: 2100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With OTLP export configured, main discards the cleanup/flush callback returned by initExportHooks. The exporter only hooks beforeExit, which does not handle the normal Ctrl+C signal path. A user can stop the server after a request and lose the last queued export batch, even though the local rows were saved. Wire a small shutdown path to the existing exporter flush.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ctrl+C and SIGTERM attempt to send the pending export batch before exiting when an exporter is configured.
- [x] #2 An unreachable collector cannot leave the local process hanging; repeated stop signals still let the user exit promptly.
- [x] #3 A subprocess regression proves a queued final record reaches a local test collector on shutdown; startup and stopping without export need no extra configuration.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope with existing stream, export, and proxy paths. Verify with local fixture providers/collectors and focused regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Returned to To Do: no production graceful-shutdown implementation was found. Export queue flush and timeout-bounded request draining must be included.

2026-09-21 product-scope pruning: narrowed to a user-visible outcome; no prerequisite architecture, security, or test-organization project.

Execution sequence: 6. Reliability and optional replay; overall position 21. See doc-4. This is scheduling order, not an artificial implementation dependency.

SIGINT/SIGTERM now drain listeners and flush queued/in-flight OTLP exports with a five-second process deadline. A second signal exits immediately. Subprocess tests verify both signals deliver the final record, a stalled collector cannot hang shutdown, and stopping without export requires no configuration.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SIGINT/SIGTERM now drain listeners and flush queued/in-flight OTLP exports with a five-second process deadline. A second signal exits immediately. Subprocess tests verify both signals deliver the final record, a stalled collector cannot hang shutdown, and stopping without export requires no configuration.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
