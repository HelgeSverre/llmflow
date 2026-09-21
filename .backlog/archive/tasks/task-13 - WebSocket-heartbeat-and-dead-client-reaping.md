---
id: TASK-13
title: WebSocket heartbeat and dead-client reaping
status: To Do
assignee: []
created_date: '2026-05-27 02:23'
updated_date: '2026-09-21 09:53'
labels:
  - reliability
  - p3
dependencies: []
references:
  - apps/server/src/server.ts
  - apps/dashboard/src/lib/stores/websocket.svelte.ts
  - apps/server/test/websocket-e2e.js
modified_files:
  - apps/server/src/server.ts
priority: low
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Normal WebSocket close callbacks and failed sends remove clients. Explicit server heartbeat deadlines and heartbeat observability are still missing; browser reconnect logic alone does not provide those guarantees.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server sends ping every 30s to each WS client
- [ ] #2 Clients that fail to pong within 10s are removed from wsClients
- [ ] #3 Dropped client count is logged (or exposed in /api/stats) for observability
- [ ] #4 Dashboard's websocket.svelte.ts auto-reconnect still works after a server-initiated drop
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Track heartbeat deadlines per client. Send protocol ping frames, handle protocol pong callbacks rather than application messages, close clients that exceed the deadline, clean up timers/state on close, and test browser reconnect after server-initiated closure.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open. Corrected the claim that all closed clients remain forever; close/send-error cleanup exists, while the requested heartbeat lifecycle and tests remain unfinished.

2026-09-21 product-scope pruning: Normal close cleanup, send-error cleanup and client reconnect exist. Extra heartbeat timers, deadlines and metrics have no demonstrated local-use failure to fix.
<!-- SECTION:NOTES:END -->
