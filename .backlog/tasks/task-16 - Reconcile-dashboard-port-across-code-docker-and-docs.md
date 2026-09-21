---
id: TASK-16
title: 'Reconcile dashboard port across code, docker, and docs'
status: Done
assignee: []
created_date: '2026-05-27 02:23'
updated_date: '2026-09-21 09:42'
labels:
  - docs
  - p3
dependencies: []
references:
  - README.md
  - docker/docker-compose.yml
  - website/index.html
  - website/llms.txt
  - packages/sdk/index.js
  - AGENTS.md
  - ARCHITECTURE.md
modified_files:
  - README.md
  - docker/docker-compose.yml
  - website/index.html
  - website/llms.txt
priority: low
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dashboard and OTLP endpoints default to port 1337 across runtime, SDK, Docker and public setup documentation. Startup uses the configured port and fails clearly if it is unavailable; it no longer selects an alternative using get-port.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All references (README, website/index.html, website/llms.txt, docker-compose.yml, examples) use the same dashboard port
- [x] #2 The chosen value matches the code default
- [x] #3 AGENTS.md and ARCHITECTURE.md reflect the chosen value
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decide 1337 (matches code default). Grep for 3000 across docs/, website/, docker/, README.md, AGENTS.md, examples/ and update each. Coordinate with task-10 (Dockerfile healthcheck) so the in-container port and HEALTHCHECK stay consistent.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dashboard defaults are standardized on 1337, including SDK and Docker configuration. Startup reports port conflicts instead of silently selecting another port. Removed stale get-port wording from this task; the existing completion criteria remain satisfied.
<!-- SECTION:FINAL_SUMMARY:END -->
