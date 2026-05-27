---
id: TASK-4
title: Per-trace body cap with truncation marker
status: To Do
assignee: []
created_date: '2026-05-27 02:21'
labels:
  - perf
  - p1
dependencies: []
references:
  - apps/server/src/server.ts
  - packages/otlp/src/traces.js
  - 'todos.md:92'
modified_files:
  - apps/server/src/server.ts
  - packages/otlp/src/traces.js
  - packages/shared/logger.js
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A 5 MB response body lands verbatim in response_body. Truncate with a marker at a configurable cap (mirror Glue's max_body_bytes — default ~64 KB for headers, ~512 KB for bodies). Truncation must happen before db.insertTrace, not after, so the DB never sees the oversized blob.
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
Add capBody(body, maxBytes) helper in packages/shared. Call it after usage extraction in handleProxyRequest, in processStreamForLogging, in passthrough logger, and in transformSpan input/output. Document the env vars in README.
<!-- SECTION:PLAN:END -->
