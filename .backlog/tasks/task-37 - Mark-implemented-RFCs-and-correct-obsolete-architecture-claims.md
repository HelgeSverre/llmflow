---
id: TASK-37
title: Mark implemented RFCs and correct obsolete architecture claims
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:27'
labels:
  - docs
dependencies: []
references:
  - docs/rfcs/README.md
  - docs/rfcs/metrics-and-logs.md
  - docs/rfcs/passthrough-mode.md
  - ARCHITECTURE.md
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: low
ordinal: 600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The RFC index calls shipped logs/metrics and passthrough features active drafts. ARCHITECTURE still contains obsolete source line anchors, a 1649-line-server claim and old all-table pruning descriptions. Preserve design history while making current status and implementation guidance accurate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Logs/metrics and passthrough RFCs are marked implemented or historical and link to current usage/implementation guidance.
- [x] #2 Architecture source references resolve without stale line-number claims; server layout and retention descriptions match current code.
- [x] #3 Original historical proposal content is retained and does not appear as a current missing-feature promise.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Update current setup and capability claims against implemented routes and workspace files; preserve historical proposal text with explicit status; verify local references and endpoint examples.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 1. Installation, examples and current documentation; overall position 6. See doc-4. This is scheduling order, not an artificial implementation dependency.

Verified isolated Bun install and clean-source production build, example preflight without provider credentials, RAG fixture run (3 local provider calls, 13 persisted spans), and existing proxy regression coverage. Current docs/source references checked; real external Claude/Aider accounts were not invoked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected installation and current-use guidance, executable example defaults/imports and integration routes; marked completed RFCs historical and aligned architecture/source references. Validation used a clean-source Bun install/build, local example preflight and provider fixtures. External client authentication is a documented prerequisite, not claimed as exercised.
<!-- SECTION:FINAL_SUMMARY:END -->
