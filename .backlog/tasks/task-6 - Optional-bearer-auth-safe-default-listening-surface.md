---
id: TASK-6
title: Optional bearer auth + safe default listening surface
status: To Do
assignee: []
created_date: '2026-05-27 02:22'
labels:
  - security
  - p1
dependencies: []
references:
  - apps/server/src/server.ts
  - docker/Dockerfile
  - docker/docker-compose.yml
  - 'todos.md:97'
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
Optional LLMFLOW_TOKEN bearer should gate /api/*, /v1/*, and the WebSocket upgrade. Today the Dockerfile and docker-compose bind 0.0.0.0 with zero auth — one copy-pasted -p and the LAN can spam /v1/traces until SQLite fills. Default bind should be 127.0.0.1; opening to 0.0.0.0 should be an explicit opt-in.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When LLMFLOW_TOKEN is set, missing/wrong bearer returns 401 on /api/*, /v1/*, and the WS upgrade handshake
- [ ] #2 Default Bun.serve hostname is 127.0.0.1; HOST=0.0.0.0 is the documented opt-in
- [ ] #3 Docker images bind 127.0.0.1 inside the container; docs explain the publish flag implications
- [ ] #4 README has a Security section covering token + binding
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Centralize auth in a small middleware applied before route dispatch. Bun.serve accepts { hostname }, default to 127.0.0.1. Read HOST env var. Add LLMFLOW_TOKEN check via constant-time comparison.
<!-- SECTION:PLAN:END -->
