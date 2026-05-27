---
id: TASK-7
title: Port packages/providers from JS to TypeScript
status: In Progress
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-05-27 03:38'
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
- [ ] #1 All packages/providers/src/*.js files converted to .ts with explicit interfaces
- [ ] #2 Provider interface defines extractUsage, identifyModel, parseStreamChunk, normalizeResponse return shapes
- [ ] #3 Server imports via ESM, no require() casts
- [ ] #4 extractUsage returns a typed { prompt_tokens, completion_tokens, total_tokens, model } shape used uniformly
- [ ] #5 Existing e2e tests pass without modification
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Convert base.js → base.ts first so the Provider interface is defined. Then each concrete provider. Update ProviderRegistry typings. Switch the server import to ESM (`import { ProviderRegistry } from '@llmflow/providers'`). Keep the package emit (tsc or bun build) into a dist/ matching the current entry point.
<!-- SECTION:PLAN:END -->
