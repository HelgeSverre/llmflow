---
id: TASK-9
title: Graceful shutdown on SIGINT/SIGTERM
status: To Do
assignee: []
created_date: '2026-05-27 02:22'
labels:
  - reliability
  - p2
dependencies: []
references:
  - apps/server/src/server.ts
  - 'todos.md:111'
modified_files:
  - apps/server/src/server.ts
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
No signal handler today. Process exit drops in-flight requests, leaves WAL un-checkpointed, and orphans WebSocket clients. Add a SIGINT/SIGTERM handler that stops accepting new requests, closes WS clients, runs PRAGMA wal_checkpoint(TRUNCATE), then db.close().
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SIGINT and SIGTERM both trigger clean shutdown
- [ ] #2 In-flight requests get up to 5s to complete; new requests rejected during shutdown
- [ ] #3 WebSocket clients receive a close frame (not a TCP RST)
- [ ] #4 PRAGMA wal_checkpoint(TRUNCATE) runs before db.close()
- [ ] #5 Process exits 0 on clean shutdown, non-zero on timeout
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Track in-flight request count via a counter incremented in the request handler. process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown). shutdown(): call server.stop(false) on both Bun.serve instances, broadcast a close frame, wait up to 5s for in-flight to drain, run WAL checkpoint, db.close(), process.exit(0).
<!-- SECTION:PLAN:END -->
