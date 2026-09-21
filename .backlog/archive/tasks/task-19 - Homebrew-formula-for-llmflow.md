---
id: TASK-19
title: Homebrew formula for llmflow
status: To Do
assignee: []
created_date: '2026-05-27 02:24'
updated_date: '2026-09-21 09:53'
labels:
  - feature
  - distribution
dependencies: []
references:
  - bin/llmflow.js
  - scripts/build-server.ts
  - scripts/test-package.ts
priority: low
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Homebrew distribution remains unimplemented in this repository. The current npm artifact uses a Node launcher and a bundled server that runs on Bun. A formula must account for these runtime requirements or deliberately package a standalone binary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Formula installs the CLI globally (npm package + bin/llmflow.js, or a prebuilt binary)
- [ ] #2 'llmflow --help' works immediately after install
- [ ] #3 Formula is published in a tap repo (helgesverre/homebrew-llmflow or similar)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Choose a formula installation artifact, declare its actual Node/Bun dependencies or build a standalone executable, then test installation, CLI startup and upgrade behavior in Homebrew. External tap publication has not been verified by this local review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open. Updated packaging assumptions to the current bundled distribution rather than source-tree execution.

2026-09-21 product-scope pruning: Another release/install channel adds ongoing maintenance without a demonstrated blocker in the existing CLI distribution. Revisit if current installation actually blocks users.
<!-- SECTION:NOTES:END -->
