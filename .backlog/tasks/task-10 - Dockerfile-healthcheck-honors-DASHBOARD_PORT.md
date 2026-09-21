---
id: TASK-10
title: Dockerfile healthcheck honors DASHBOARD_PORT
status: Done
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-09-21 09:42'
labels:
  - bug
  - p2
dependencies: []
references:
  - docker/Dockerfile
  - docker/docker-compose.yml
modified_files:
  - docker/Dockerfile
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Docker healthcheck reads DASHBOARD_PORT with a 1337 default and uses Bun fetch against /api/health. Compose port configuration follows the same default.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HEALTHCHECK reads DASHBOARD_PORT and defaults to 1337.
- [x] #2 An image run with DASHBOARD_PORT=9000 passes the healthcheck.
- [x] #3 Compose configuration remains consistent with the Dockerfile port decision.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Completed: execute the health probe with Bun, use process.env.DASHBOARD_PORT || 1337, and keep Docker/Compose defaults aligned.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Docker health probing honors DASHBOARD_PORT through Bun fetch and defaults to 1337. Compose uses the same dashboard default. The task records historical container verification; the September reconciliation checked source configuration and did not rerun Docker.
<!-- SECTION:FINAL_SUMMARY:END -->
