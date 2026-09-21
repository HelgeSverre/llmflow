---
id: TASK-4
title: Per-trace body cap with truncation marker
status: To Do
assignee: []
created_date: '2026-05-27 02:21'
updated_date: '2026-09-21 09:53'
labels:
  - perf
  - p1
dependencies: []
references:
  - apps/server/src/proxy.ts
  - packages/providers/src/stream.ts
  - packages/db/src/index.ts
  - packages/otlp/src/traces.js
modified_files:
  - apps/server/src/server.ts
  - packages/otlp/src/traces.js
  - packages/shared/logger.js
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Configurable capture limits for persisted request and response bodies remain unimplemented. Existing proxy response transport limits and StreamSession text/frame limits are separate controls; they do not implement the proposed MAX_REQUEST_BODY_BYTES and MAX_RESPONSE_BODY_BYTES settings across proxy and OTLP capture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MAX_REQUEST_BODY_BYTES and MAX_RESPONSE_BODY_BYTES env vars with sensible defaults (~512 KB)
- [ ] #2 Truncated bodies append a '[truncated: N bytes]' marker so the dashboard signals the truncation
- [ ] #3 Usage / pricing extraction happens BEFORE truncation so token counts stay correct
- [ ] #4 Applies to proxy mode, passthrough mode, and OTLP processOtlpTraces input/output normalization
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Define capture-only limits and explicit truncation metadata at persistence boundaries. Extract usage before truncation, preserve forwarding behavior, apply limits to proxy and OTLP records, and test large inputs and outputs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open. Removed references to deleted streaming logger functions and nonexistent shared capture helpers.

2026-09-21 product-scope pruning: Broad configurable body caps add tuning and can discard the payloads this local debugging tool exists to inspect. No demonstrated normal-use failure justifies universal 512 KB limits. Keep the concrete unbounded tool-capture issue in task 1 instead.
<!-- SECTION:NOTES:END -->
