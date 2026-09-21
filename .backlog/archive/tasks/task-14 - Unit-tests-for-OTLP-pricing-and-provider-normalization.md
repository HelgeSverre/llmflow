---
id: TASK-14
title: 'Unit tests for OTLP, pricing, and provider normalization'
status: To Do
assignee: []
created_date: '2026-05-27 02:23'
updated_date: '2026-09-21 09:53'
labels:
  - testing
  - p3
dependencies: []
references:
  - apps/server/test/providers.js
  - apps/server/test/stream-formats.test.ts
  - apps/server/test/telemetry-regressions.test.ts
  - packages/pricing/src/index.js
  - packages/otlp/src/traces.js
modified_files:
  - packages/otlp/
  - packages/pricing/
  - packages/providers/
priority: low
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Direct provider fixtures and StreamSession unit tests already provide fast coverage, and OTLP integration/regression tests exist. This task still calls for focused package-local provider, pricing and OTLP tests, especially pricing calculation edge cases, without requiring a running server.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Removed the stale assertion that all current tests spawn a server. Package-local test organization and the requested pricing unit coverage remain open.

2026-09-21 product-scope pruning: Blanket package-local coverage and a universal two-second suite target are process goals, not a product issue. Add focused regression tests with real bugs and features using the existing test setup.
<!-- SECTION:NOTES:END -->
