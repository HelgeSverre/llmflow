---
id: TASK-34
title: Correct Aider and Claude Code integration instructions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:27'
labels:
  - bug
  - docs
  - integration
dependencies: []
references:
  - examples/aider/README.md
  - examples/claude-code/README.md
  - docs/guides/ai-cli-tools.md
  - apps/server/src/server.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Aider guide uses nonexistent :3000/proxy/openai/v1. The Claude Code guide calls OTLP logs/metrics and native Anthropic passthrough unsupported, although the server implements them. Replace these misleading alternatives with working current routes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Aider snippets consistently use the supported default OpenAI-compatible proxy base URL http://localhost:8080/v1.
- [x] #2 Claude Code instructions describe implemented OTLP traces/logs/metrics on 1337 and native Anthropic passthrough on the proxy; removed unsupported/future-work claims are not repeated.
- [x] #3 Validate documented URLs/configuration against local routes and local upstream fixtures; separate any external client prerequisite from server capability.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Update current setup and capability claims against implemented routes and workspace files; preserve historical proposal text with explicit status; verify local references and endpoint examples.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 1. Installation, examples and current documentation; overall position 3. See doc-4. This is scheduling order, not an artificial implementation dependency.

Verified isolated Bun install and clean-source production build, example preflight without provider credentials, RAG fixture run (3 local provider calls, 13 persisted spans), and existing proxy regression coverage. Current docs/source references checked; real external Claude/Aider accounts were not invoked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected installation and current-use guidance, executable example defaults/imports and integration routes; marked completed RFCs historical and aligned architecture/source references. Validation used a clean-source Bun install/build, local example preflight and provider fixtures. External client authentication is a documented prerequisite, not claimed as exercised.
<!-- SECTION:FINAL_SUMMARY:END -->
