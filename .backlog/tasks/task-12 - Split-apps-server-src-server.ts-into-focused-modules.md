---
id: TASK-12
title: Split apps/server/src/server.ts into focused modules
status: To Do
assignee: []
created_date: '2026-05-27 02:23'
labels:
  - refactor
  - p3
dependencies: []
references:
  - apps/server/src/server.ts
  - ARCHITECTURE.md
  - 'todos.md:121'
modified_files:
  - apps/server/src/server.ts
priority: low
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
apps/server/src/server.ts is currently ~1,649 lines. ARCHITECTURE.md suggests splitting into routes/api.ts, routes/otlp.ts, proxy/handler.ts, proxy/streaming.ts, health/providers.ts, ws/hub.ts, static.ts. The top-level dispatcher becomes ~80 lines and matches the component boundaries already in the architecture doc.
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
Land in this order so each diff stays reviewable: 1) static.ts (lowest coupling), 2) ws/hub.ts (wsClients + broadcast), 3) routes/otlp.ts, 4) proxy/streaming.ts, 5) proxy/handler.ts, 6) routes/api.ts. Each step is its own PR. Defer until P1 work has landed so we don't fight conflicts.
<!-- SECTION:PLAN:END -->
