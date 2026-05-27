---
id: TASK-10
title: Dockerfile healthcheck honors DASHBOARD_PORT
status: To Do
assignee: []
created_date: '2026-05-27 02:22'
labels:
  - bug
  - p2
dependencies: []
references:
  - docker/Dockerfile
  - docker/docker-compose.yml
  - 'todos.md:113'
modified_files:
  - docker/Dockerfile
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The HEALTHCHECK line in docker/Dockerfile hardcodes the port. If a user overrides DASHBOARD_PORT, the healthcheck fails silently. Either honor the env var via shell expansion or freeze the in-container port and document the convention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 HEALTHCHECK uses ${DASHBOARD_PORT:-3000} (or the chosen frozen value)
- [ ] #2 docker build + docker run with DASHBOARD_PORT=9000 produces a passing healthcheck
- [ ] #3 docker-compose.yml stays consistent with the Dockerfile decision
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use shell-form HEALTHCHECK so env expansion works: HEALTHCHECK CMD curl -f http://localhost:${DASHBOARD_PORT:-3000}/api/health || exit 1. Coordinate with the port-consistency task.
<!-- SECTION:PLAN:END -->
