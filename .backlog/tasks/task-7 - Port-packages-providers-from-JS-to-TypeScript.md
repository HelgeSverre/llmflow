---
id: TASK-7
title: Port packages/providers from JS to TypeScript
status: Done
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-09-21 09:42'
labels:
  - refactor
  - p2
dependencies: []
references:
  - packages/providers/src/base.ts
  - packages/providers/src/index.ts
  - packages/providers/src/stream.ts
  - apps/server/src/proxy.ts
  - apps/server/test/providers.js
modified_files:
  - packages/providers/
  - apps/server/src/server.ts
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provider adapters use TypeScript with explicit request, usage, normalized response and StreamSession contracts. The server proxy imports providers through ESM, making adapter boundaries typechecked.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Provider source files use TypeScript with explicit interfaces.
- [x] #2 Provider contracts type extractUsage, identifyRequestModel, normalizeResponse and createStreamSession.
- [x] #3 Server provider imports use ESM without require casts.
- [x] #4 extractUsage returns the shared TokenUsage shape with optional model metadata.
- [x] #5 Provider and stream fixture tests preserve supported request/response behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Completed: typed provider interfaces and implementations, ESM imports, and direct provider/stream regression coverage. Bun loads workspace TypeScript; the shipping server is bundled separately.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Provider adapters and the proxy boundary are typed ESM. TokenUsage and StreamSession replace the old identifyModel/parseStreamChunk assumptions. Provider fixtures and stream regression tests cover the current interfaces. Historical Docker verification was recorded in May; this reconciliation does not claim a new Docker run.
<!-- SECTION:FINAL_SUMMARY:END -->
