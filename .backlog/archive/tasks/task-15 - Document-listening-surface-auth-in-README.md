---
id: TASK-15
title: Document listening surface + auth in README
status: To Do
assignee: []
created_date: '2026-05-27 02:23'
updated_date: '2026-09-21 09:53'
labels:
  - docs
  - p3
dependencies: []
references:
  - README.md
  - docker/docker-compose.yml
modified_files:
  - README.md
  - docker/docker-compose.yml
priority: low
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
README documents current native loopback binding, PROXY_HOST/DASHBOARD_HOST overrides and safe Docker publishing. Optional bearer auth is not implemented, so operational authentication instructions cannot be complete until task-6 lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README documents actual bind settings, Docker exposure implications and working bearer authentication once task-6 is implemented.
- [x] #2 Compose publishes on host loopback by default and documents deliberate external exposure.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Single section + a callout box. Easy to land in the same PR as task-6 or directly after.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Reopened because the previous Done summary treated planned LLMFLOW_TOKEN authentication as implemented. Binding documentation is complete; auth instructions remain dependent on task-6.

2026-09-21 product-scope pruning: Auth work is intentionally dropped for the local product. Current binding documentation is enough; no token setup guide is needed.
<!-- SECTION:NOTES:END -->
