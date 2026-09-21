---
id: TASK-32
title: Repair installation quick starts and example endpoint defaults
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:27'
labels:
  - bug
  - docs
  - installation
dependencies: []
references:
  - README.md
  - examples/README.md
  - examples/run-all.sh
  - examples/langchain/README.md
  - examples/ai-sdk-proxy/README.md
  - examples/vercel-ai-sdk/README.md
  - examples/rag-pipeline/README.md
  - package.json
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Examples prescribe npm install, make examples and dashboard port 3000. npm installation fails on workspace:*; the Makefile target does not exist. Framework scripts and run-all.sh also use the wrong dashboard/OTLP port. Fix runnable setup and its instructions together; proxy port remains 8080.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Root and example quick starts specify working Bun setup/start commands, actual prerequisites and an existing example runner; no nonexistent make target is prescribed.
- [x] #2 Dashboard/OTLP defaults in framework READMEs, executable examples and run-all.sh are 1337; proxy defaults stay 8080 and explicit overrides still work.
- [x] #3 Follow the documented fresh-checkout installation/start flow and example-runner preflight against an isolated local server; verify requests use the documented endpoints without requiring paid provider calls.
- [x] #4 Dashboard source directories are not accidentally ignored; an isolated copy of Git-visible sources builds successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Correct setup commands and endpoint defaults in docs and runnable examples; make runner preflight usable without paid calls; verify a fresh Bun installation and isolated local startup.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 1. Installation, examples and current documentation; overall position 1. See doc-4. This is scheduling order, not an artificial implementation dependency.

Fresh Bun install passed, but clean-source build exposed apps/dashboard/.gitignore ignoring every logs directory, including three required Svelte components. Narrowing the rule to root runtime logs.

Verified isolated Bun install and clean-source production build, example preflight without provider credentials, RAG fixture run (3 local provider calls, 13 persisted spans), and existing proxy regression coverage. Current docs/source references checked; real external Claude/Aider accounts were not invoked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected installation and current-use guidance, executable example defaults/imports and integration routes; marked completed RFCs historical and aligned architecture/source references. Validation used a clean-source Bun install/build, local example preflight and provider fixtures. External client authentication is a documented prerequisite, not claimed as exercised.
<!-- SECTION:FINAL_SUMMARY:END -->
