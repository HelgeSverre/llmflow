---
id: TASK-19
title: Homebrew formula for llmflow
status: To Do
assignee: []
created_date: '2026-05-27 02:24'
labels:
  - feature
  - distribution
dependencies: []
references:
  - bin/llmflow.js
  - 'todos.md:144'
priority: low
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make 'brew install llmflow' work. Tap first; consider homebrew-core once a few releases prove stability.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Formula installs the CLI globally (npm package + bin/llmflow.js, or a prebuilt binary)
- [ ] #2 'llmflow --help' works immediately after install
- [ ] #3 Formula is published in a tap repo (helgesverre/homebrew-llmflow or similar)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decide between (a) wrapping the npm install (depends on node/bun) or (b) building a single-file binary with bun build --compile and shipping that. Option (b) gives the cleanest brew experience.
<!-- SECTION:PLAN:END -->
