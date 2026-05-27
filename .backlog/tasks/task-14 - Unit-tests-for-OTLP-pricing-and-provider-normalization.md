---
id: TASK-14
title: 'Unit tests for OTLP, pricing, and provider normalization'
status: To Do
assignee: []
created_date: '2026-05-27 02:23'
labels:
  - testing
  - p3
dependencies: []
references:
  - packages/otlp/
  - packages/pricing/
  - packages/providers/
  - 'todos.md:126'
modified_files:
  - packages/otlp/
  - packages/pricing/
  - packages/providers/
priority: low
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current tests spawn the whole server — there's no fast inner loop for OTLP attribute extraction, pricing edge cases, or provider response normalization. Add bun:test unit tests inside each package.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/otlp tests cover transformSpan, extractSessionId, extractConversationId, extractAgentName, determineSpanType
- [ ] #2 packages/pricing tests cover the LiteLLM-loaded path, the fallback path, and zero-token edge cases
- [ ] #3 packages/providers tests cover extractUsage across OpenAI, Anthropic, Gemini and at least one OpenAI-compatible impl
- [ ] #4 Whole unit-test suite (excluding e2e) runs under 2s on a clean machine
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Each package gets a test/ dir with co-located fixture files. Capture real OTLP payloads from existing e2e runs to use as fixtures. Add 'bun test' as a workspace-aware npm script.
<!-- SECTION:PLAN:END -->
