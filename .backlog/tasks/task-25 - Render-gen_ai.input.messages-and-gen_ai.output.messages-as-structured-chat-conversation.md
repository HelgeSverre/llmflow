---
id: TASK-25
title: Show captured LLM conversations as readable messages and tool calls
status: Done
assignee:
  - '@codex'
created_date: '2026-05-27 15:59'
updated_date: '2026-09-21 11:48'
labels:
  - dashboard
  - trace-viewer
  - otel
dependencies: []
references:
  - apps/dashboard/src/lib/components/trace-viewer/SpanDetailPanel.svelte
  - packages/otlp/src/traces.js
  - docs/reference/trace-span-viewer-ui/mockup-intended-design.html
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 1900
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SpanDetailPanel currently renders captured input/output JSON. OTLP ingestion already parses structured message attributes into message objects; a conversation renderer should consume that parsed shape and render role/parts directly. Handle known serialized payloads at their boundary and retain readable raw output for genuinely unknown shapes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 input tab renders messages as role-tagged cards, not raw JSON
- [x] #2 output tab renders the same way
- [x] #3 text parts render as text; tool_call parts render with name + arguments JSON; tool_call_response parts render with response JSON
- [x] #4 Falls back gracefully when messages are not valid JSON or have unexpected shape
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope using existing API and detail components; add focused browser regressions and verify typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open. Removed the incorrect assumption that every message is a JSON string and the unsupported explanation about OTel any-value support.

Execution sequence: 5. Readable trace inspection; overall position 19. See doc-4. This is scheduling order, not an artificial implementation dependency.

Captured input/output conversations now render as role-tagged cards with text, named tool calls, arguments and tool responses. Known serialized message payloads are decoded, with readable raw fallback for unknown shapes. Browser tests verify both message tabs and tools.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Captured input/output conversations now render as role-tagged cards with text, named tool calls, arguments and tool responses. Known serialized message payloads are decoded, with readable raw fallback for unknown shapes. Browser tests verify both message tabs and tools.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
