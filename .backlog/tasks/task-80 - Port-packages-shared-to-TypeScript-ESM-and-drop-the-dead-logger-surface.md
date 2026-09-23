---
id: TASK-80
title: Port packages/shared to TypeScript ESM and drop the dead logger surface
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 12:40'
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
- [x] #1 packages/shared is TypeScript ESM with typecheck in `bun run typecheck`; no .js source remains
- [x] #2 Logger exposes only the methods that have callers (plus warn if adopted); every '[llmflow]' console line in scripts goes through it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Port logger/redaction to TS ESM, drop dead logger methods and the unused root index. 2. Switch TS importers to ESM imports; CJS importers (otlp export, pricing) destructure { log }. 3. Route every [llmflow] console line in scripts/dev-runtime/dashboard dev/server startup through log. 4. Colocate the logger test in packages/shared. 5. Gate + test:package.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- @llmflow/shared exports only ./logger and ./redaction (both .ts, type module); the root '.' export and src/index.js are gone (no importers).
- Logger surface: info, warn, error(message, cause?), debug. warn adopted for 'port is busy' lines. error now writes to console.error (stderr); before it used console.log.
- CommonJS consumers (packages/otlp/src/export.js, packages/pricing/src/index.js) load it with const { log } = require('@llmflow/shared/logger') — Bun require() of an ESM module returns the namespace. TASK-81/82/83 should switch these to import when porting.
- pricing no longer parses VERBOSE itself; it uses log.debug.
- New workspace deps on @llmflow/shared: dev-runtime, pricing, dashboard (dev), root (dev, for scripts/docker-dev.ts).
- packages/sdk still prints its own [llmflow] lines on purpose: it is published standalone and cannot depend on the private shared package (TASK-84).
- Logger test moved to packages/shared/src/logger.test.ts; apps/server/test/env-and-logger.test.ts renamed to env-example.test.ts (only .env.example/DATA_DIR tests remain).
Validation: bun run check green (shared now in typecheck), bun run test 209 pass/1 skip + dashboard 113, bun run test:package passed, built server prints startup lines via log and the pricing debug line with VERBOSE=1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
packages/shared is now TypeScript ESM (logger.ts, redaction.ts) with its own typecheck; the logger keeps only info/warn/error/debug and every [llmflow] line in scripts and server startup goes through it. Verified with bun run check, bun run test, test:package and a run of the built server.
<!-- SECTION:FINAL_SUMMARY:END -->
