---
id: TASK-6
title: Optional bearer auth + safe default listening surface
status: In Progress
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-09-21 09:53'
labels:
  - security
  - p1
dependencies: []
references:
  - apps/server/src/server.ts
  - apps/server/src/websocket-origin.ts
  - docker/docker-compose.yml
  - README.md
modified_files:
  - apps/server/src/server.ts
  - docker/Dockerfile
  - docker/docker-compose.yml
  - README.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Native listeners bind to 127.0.0.1 by default; Docker listens internally on 0.0.0.0 while Compose publishes on host loopback. WebSocket origin checks are implemented. Optional bearer authentication is still missing; origin checks and local binding are not authentication.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When LLMFLOW_TOKEN is set, missing/wrong bearer returns 401 on /api/*, /v1/*, and the WS upgrade handshake
- [ ] #2 README has a Security section covering token + binding
- [x] #3 Default native Bun listeners bind 127.0.0.1; DASHBOARD_HOST and PROXY_HOST are documented explicit overrides.
- [x] #4 Docker listeners bind 0.0.0.0 inside the container and default published ports bind 127.0.0.1 on the host.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Listener binding and host-loopback Docker publishing are complete through task 27 using DASHBOARD_HOST and PROXY_HOST. Remaining work: implement optional LLMFLOW_TOKEN bearer authentication for API, OTLP and WebSocket routes, then document and test the token contract.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task 27 implements GitHub issues #5–#33. Listener defaults, host overrides, Origin validation and host-loopback Docker publishing are verified. Corrected the stale HOST variable and unreachable container-loopback requirements. Optional bearer authentication remains separate and is not implemented by this issue batch.

2026-09-21 reconciliation: Retained partial status: binding and Docker criteria are complete; bearer auth and its operational documentation remain open.

2026-09-21 product-scope pruning: User explicitly rejects an authentication/security roadmap for this intentionally local tool. Existing local defaults stay; bearer-token setup and per-endpoint auth work are dropped.
<!-- SECTION:NOTES:END -->
