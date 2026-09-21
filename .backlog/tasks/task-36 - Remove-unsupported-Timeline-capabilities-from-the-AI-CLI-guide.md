---
id: TASK-36
title: Remove unsupported Timeline capabilities from the AI CLI guide
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:27'
labels:
  - docs
dependencies: []
references:
  - docs/guides/ai-cli-tools.md
  - apps/dashboard/src/lib/components/timeline/TimelineTab.svelte
  - apps/dashboard/src/lib/stores/timeline.svelte.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: medium
ordinal: 500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current AI CLI guide promises Timeline metrics and a metric-type filter that neither the API nor UI provides. Its related-log claim also depends on the existing trace-ID correlation bug tracked in task 31.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide describes Timeline trace/log support and the separate Metrics tab accurately.
- [x] #2 The related-log claim is removed or qualified while task 31 is unresolved, and documented examples do not rely on the broken behavior.
- [x] #3 Current guide controls, labels and routes match the implemented UI/API; historical notes are clearly distinguished.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Update current setup and capability claims against implemented routes and workspace files; preserve historical proposal text with explicit status; verify local references and endpoint examples.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 1. Installation, examples and current documentation; overall position 5. See doc-4. This is scheduling order, not an artificial implementation dependency.

Verified isolated Bun install and clean-source production build, example preflight without provider credentials, RAG fixture run (3 local provider calls, 13 persisted spans), and existing proxy regression coverage. Current docs/source references checked; real external Claude/Aider accounts were not invoked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected installation and current-use guidance, executable example defaults/imports and integration routes; marked completed RFCs historical and aligned architecture/source references. Validation used a clean-source Bun install/build, local example preflight and provider fixtures. External client authentication is a documented prerequisite, not claimed as exercised.
<!-- SECTION:FINAL_SUMMARY:END -->
