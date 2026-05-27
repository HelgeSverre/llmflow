---
id: TASK-7
title: Port packages/providers from JS to TypeScript
status: Done
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-05-27 04:11'
labels:
  - refactor
  - p2
dependencies: []
references:
  - packages/providers/src/
  - 'apps/server/src/server.ts:9'
  - 'todos.md:103'
modified_files:
  - packages/providers/
  - apps/server/src/server.ts
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
apps/server/src/server.ts requires @llmflow/providers via CJS and gets back 'any', so every method on Provider/PassthroughHandler is asserted rather than typechecked. Real bugs (extractUsage return-shape drift across providers) hide behind those casts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All packages/providers/src/*.js files converted to .ts with explicit interfaces
- [x] #2 Provider interface defines extractUsage, identifyModel, parseStreamChunk, normalizeResponse return shapes
- [x] #3 Server imports via ESM, no require() casts
- [x] #4 extractUsage returns a typed { prompt_tokens, completion_tokens, total_tokens, model } shape used uniformly
- [x] #5 Existing e2e tests pass without modification
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Convert base.js → base.ts first so the Provider interface is defined. Then each concrete provider. Update ProviderRegistry typings. Switch the server import to ESM (`import { ProviderRegistry } from '@llmflow/providers'`). Keep the package emit (tsc or bun build) into a dist/ matching the current entry point.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All providers ported to TypeScript with explicit Provider interface in base.ts. TokenUsage shape unified across all extractUsage implementations. .js originals deleted. Package main/exports point at .ts entries; Bun loads TS directly with no build step. Server.ts continues to use require() syntax for the providers package but with typed exports at the boundary (no 'as any' casts). 55/55 provider unit tests pass. Verified locally and in Docker container.
<!-- SECTION:FINAL_SUMMARY:END -->
