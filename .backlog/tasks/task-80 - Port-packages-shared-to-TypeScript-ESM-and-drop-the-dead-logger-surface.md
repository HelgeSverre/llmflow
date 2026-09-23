---
id: TASK-80
title: Port packages/shared to TypeScript ESM and drop the dead logger surface
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - typescript
  - dead-code
milestone: m-0
dependencies:
  - TASK-77
references:
  - packages/shared/src/logger.js
  - packages/shared/src/index.js
priority: high
type: task
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`packages/shared` is CommonJS JS consumed via untyped `require()`. Only `info`, `error`, `debug` are called; `startup`, `url`, `warn`, `request`, `response`, `proxy`, `dashboard`, `isVerbose`, `formatDuration`, `formatTokens` (`logger.js:37-135`, ~85 LOC) are dead. `src/index.js` (package root) has no importers. `packages/pricing/src/index.js:9,67` re-parses VERBOSE and prints its own ANSI line; `scripts/dev*.ts`, `apps/dashboard/dev.ts` and `server.ts:1039` hand-write the `[llmflow]` prefix.
Port to `src/logger.ts` with `"type": "module"`, proper `exports`, a `tsconfig.json` and `typecheck` script.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/shared is TypeScript ESM with typecheck in `bun run typecheck`; no .js source remains
- [ ] #2 Logger exposes only the methods that have callers (plus warn if adopted); every '[llmflow]' console line in scripts goes through it
<!-- AC:END -->
