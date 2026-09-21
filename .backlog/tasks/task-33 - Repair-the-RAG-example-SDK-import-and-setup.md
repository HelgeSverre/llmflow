---
id: TASK-33
title: Repair the RAG example SDK import and setup
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:27'
labels:
  - bug
  - docs
  - examples
dependencies: []
references:
  - examples/rag-pipeline/index.js
  - examples/rag-pipeline/README.md
  - examples/rag-pipeline/package.json
  - packages/sdk/index.js
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The runnable RAG example and its README import ../../sdk/index.js, but the root SDK directory was removed. The example package also lacks an llmflow-sdk dependency. This prevents the example from starting independently of the port problem.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The RAG example resolves the actual SDK through a correctly declared package dependency or a documented working workspace path.
- [x] #2 README imports, installation instructions and executable example agree.
- [x] #3 A clean example setup and smoke run reach local span submission using a fixture/stub when provider calls would otherwise be required.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Declare the local SDK dependency, update example imports/docs, and smoke-run with a local provider fixture after installation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 1. Installation, examples and current documentation; overall position 2. See doc-4. This is scheduling order, not an artificial implementation dependency.

Verified isolated Bun install and clean-source production build, example preflight without provider credentials, RAG fixture run (3 local provider calls, 13 persisted spans), and existing proxy regression coverage. Current docs/source references checked; real external Claude/Aider accounts were not invoked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected installation and current-use guidance, executable example defaults/imports and integration routes; marked completed RFCs historical and aligned architecture/source references. Validation used a clean-source Bun install/build, local example preflight and provider fixtures. External client authentication is a documented prerequisite, not claimed as exercised.
<!-- SECTION:FINAL_SUMMARY:END -->
