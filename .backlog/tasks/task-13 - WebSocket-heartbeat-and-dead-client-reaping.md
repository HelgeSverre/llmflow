---
id: TASK-13
title: WebSocket heartbeat and dead-client reaping
status: To Do
assignee: []
created_date: '2026-05-27 02:23'
labels:
  - reliability
  - p3
dependencies: []
references:
  - 'apps/server/src/server.ts:173-175'
  - 'todos.md:124'
modified_files:
  - apps/server/src/server.ts
priority: low
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
wsClients grows forever on flaky clients. Today there's no ping/pong and the only cleanup is the send-error catch in broadcast(). Add server-initiated heartbeats and drop clients that don't pong.
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
Maintain a Map<WebSocket, { last_pong_at: number }>. setInterval(30s) sends ping. Separate setInterval(5s) scans the map and drops stale entries. ws.ping() in Bun + listen for 'pong' message.
<!-- SECTION:PLAN:END -->
