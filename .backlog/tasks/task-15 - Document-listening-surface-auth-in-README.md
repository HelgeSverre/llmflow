---
id: TASK-15
title: Document listening surface + auth in README
status: Done
assignee: []
created_date: '2026-05-27 02:23'
updated_date: '2026-05-27 03:38'
labels:
  - docs
  - p3
dependencies:
  - TASK-6
references:
  - README.md
  - docker/docker-compose.yml
  - 'todos.md:129'
modified_files:
  - README.md
  - docker/docker-compose.yml
priority: low
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once optional bearer auth and the safer default binding land (task-6), the README needs an explicit Security section. Especially important for Docker users — the current docker-compose binds 0.0.0.0 with no auth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README has a Security section covering: default binding (127.0.0.1), HOST=0.0.0.0 opt-in, LLMFLOW_TOKEN bearer, and the Docker -p flag implications
- [ ] #2 docker-compose.yml example shows the safe default; the unsafe variant is a documented alternative
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Single section + a callout box. Easy to land in the same PR as task-6 or directly after.
<!-- SECTION:PLAN:END -->
