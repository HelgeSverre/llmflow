---
id: TASK-12
title: Split apps/server/src/server.ts into focused modules
status: To Do
assignee: []
created_date: '2026-05-27 02:23'
updated_date: '2026-09-21 09:53'
labels:
  - refactor
  - p3
dependencies: []
references:
  - apps/server/src/server.ts
  - apps/server/src/proxy.ts
  - apps/server/src/websocket-origin.ts
  - packages/otlp/src/transport.js
modified_files:
  - apps/server/src/server.ts
priority: low
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The server has been partially decomposed: proxy forwarding, WebSocket origin policy, OTLP transport and streaming parsing now live in dedicated modules. server.ts still owns substantial routing, static serving, health and WebSocket lifecycle code. Complete the remaining decomposition while preserving endpoint behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server.ts shrinks to ≤200 lines (dispatcher only)
- [ ] #2 Each split module is self-contained with explicit imports — no shared mutable module-level state across files
- [ ] #3 Existing tests + e2e pass with zero behavior change
- [ ] #4 AGENTS.md and ARCHITECTURE.md updated to point at the new file paths
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Keep existing extracted modules. Identify cohesive remaining API/static/WebSocket modules, move route ownership with typed interfaces, and reduce the entry point to initialization/dispatch. Run endpoint and WebSocket regressions after each boundary change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Updated scope to the remaining routing/lifecycle work; removed stale line counts and plans to re-extract an already extracted proxy.

2026-09-21 product-scope pruning: File-count and 200-line targets produce code movement without a user-visible outcome. Refactor only where needed to implement or repair a concrete feature.
<!-- SECTION:NOTES:END -->
