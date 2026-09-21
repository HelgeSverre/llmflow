---
id: TASK-35
title: Bring llms.txt setup and source references into line with the app
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:27'
labels:
  - docs
  - installation
dependencies: []
references:
  - website/llms.txt
  - README.md
  - ARCHITECTURE.md
  - apps/server/src/server.ts
  - packages/providers/package.json
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
website/llms.txt is current machine-readable guidance but contains broken npm workspace setup, removed source paths, CJS provider claims and obsolete automatic port fallback behavior. Correct the facts AI/search consumers will use to configure and explain the app.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Setup instructions agree with the verified Bun installation flow and the current dashboard/proxy defaults.
- [x] #2 Source references resolve to actual apps/ and packages/ paths; provider modules are described as TypeScript/ESM.
- [x] #3 Port conflicts are documented as startup failures, not silent fallback; related runtime claims match current code.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Update current setup and capability claims against implemented routes and workspace files; preserve historical proposal text with explicit status; verify local references and endpoint examples.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 1. Installation, examples and current documentation; overall position 4. See doc-4. This is scheduling order, not an artificial implementation dependency.

Verified isolated Bun install and clean-source production build, example preflight without provider credentials, RAG fixture run (3 local provider calls, 13 persisted spans), and existing proxy regression coverage. Current docs/source references checked; real external Claude/Aider accounts were not invoked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected installation and current-use guidance, executable example defaults/imports and integration routes; marked completed RFCs historical and aligned architecture/source references. Validation used a clean-source Bun install/build, local example preflight and provider fixtures. External client authentication is a documented prerequisite, not claimed as exercised.
<!-- SECTION:FINAL_SUMMARY:END -->
