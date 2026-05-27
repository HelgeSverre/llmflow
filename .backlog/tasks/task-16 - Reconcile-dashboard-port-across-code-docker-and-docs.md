---
id: TASK-16
title: 'Reconcile dashboard port across code, docker, and docs'
status: Done
assignee: []
created_date: '2026-05-27 02:23'
updated_date: '2026-05-27 04:11'
labels:
  - docs
  - p3
dependencies: []
references:
  - README.md
  - docker/docker-compose.yml
  - website/index.html
  - website/llms.txt
  - 'todos.md:131'
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
The dashboard port differs across surfaces: code default 1337 (via get-port), docker-compose default 3000, README uses 1337, website/index.html and website/llms.txt use 3000. Pick one and update everything.
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
Standardized on port 1337 across code (get-port default), Dockerfile (ENV DASHBOARD_PORT + EXPOSE), docker-compose.yml, README, AGENTS.md, ARCHITECTURE.md, DOCKER_HUB.md, website/index.html, website/llms.txt. Vite proxy and docs follow-up landed in a0163e3.
<!-- SECTION:FINAL_SUMMARY:END -->
