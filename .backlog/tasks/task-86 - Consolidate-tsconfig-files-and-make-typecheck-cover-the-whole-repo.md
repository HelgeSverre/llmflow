---
id: TASK-86
title: Consolidate tsconfig files and make typecheck cover the whole repo
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 18:32'
labels:
  - typescript
milestone: m-0
dependencies:
  - TASK-85
references:
  - tsconfig.base.json
  - apps/dashboard/tsconfig.app.json
  - scripts/tsconfig.json
priority: medium
type: chore
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- `tsconfig.base.json` sets `declaration`, `declarationMap`, `sourceMap` and `lib: DOM` for server code although every consumer is noEmit; `packages/db/tsconfig.json` has `rootDir`/`outDir` for nothing; `apps/server/tsconfig.json` has redundant `allowSyntheticDefaultImports`.
- `verbatimModuleSyntax` is false in base, true in both dashboard configs. `types` differs: bun-types (base/server/db/scripts), node (`tsconfig.node.json`), svelte+vite/client (`tsconfig.app.json`). `apps/dashboard/dev.ts` runs under Vite but is typechecked with bun-types via `scripts/tsconfig.json`; `scripts/` and `apps/dashboard` import each other.
- Not checked by anything: e2e specs (7 have `// @ts-check` but no tsconfig), `playwright.config.ts`, `apps/dashboard/vitest.config.ts`, `svelte.config.js`, website script.
- Enable `noUnusedLocals`/`noUnusedParameters` repo-wide.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One base config with per-workspace extensions; no emit-related options in noEmit configs; one verbatimModuleSyntax setting
- [x] #2 `bun run typecheck` covers apps/*, packages/*, scripts/, e2e/ and the root config files, and passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Base: noEmit, drop emit/sourcemap options, verbatimModuleSyntax true, noUnused* on, lib ES2023. 2. Every workspace config extends the base (dashboard too); only the SDK build config emits. 3. Root tsconfig.json for scripts/ + playwright.config.ts; dashboard node config adds svelte.config.js. 4. Fix what the stricter settings surface. 5. Gate, test:package, Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- tsconfig.base.json is the single base: ES2022 target, Bundler resolution, lib ES2023, types bun, strict + noImplicitOverride + noUnusedLocals/Parameters + noFallthroughCasesInSwitch, verbatimModuleSyntax true (the Svelte preprocessor needs it; server code already complied), moduleDetection force, noEmit true. No declaration/declarationMap/sourceMap anywhere except packages/sdk/tsconfig.build.json (the only emitting config: extends ./tsconfig.json, noEmit false, declaration, rootDir src, outDir dist).
- Workspace configs are 'extends base + include' (plus lib DOM for e2e and the dashboard app, types svelte/vite/client + paths + allowJs/checkJs for the dashboard app, allowJs/checkJs for the dashboard node config). packages/db rootDir/outDir and the server's allowSyntheticDefaultImports/exclude are gone. @tsconfig/svelte removed from the dashboard.
- Dashboard node config (vite.config.ts, vitest.config.ts, svelte.config.js, dev.ts) uses bun types: dev.ts runs under 'bun dev.ts'.
- Root tsconfig.json (scripts/*.ts, playwright.config.ts) replaces scripts/tsconfig.json; root typecheck = bun run --filter '*' typecheck && tsc -p tsconfig.json. website/ is outside the workspaces (TASK-101) and not typechecked.
- Dropping DOM from server-side configs makes Bun's fetch().json()/request.json() return unknown instead of any: 8 test call sites now declare their row types; otlp export's encodePayload returns string | Buffer instead of BodyInit; replay.ts passes url.toString() to new Request (Bun's typing has no URL overload).
- noUnusedLocals found one unused import (formatTimestamp in LogsTable.svelte).
Validation: bun run check green (all 10 workspaces + root config typecheck, svelte-check 193 files 0 errors); bun run test 216 pass/1 skip + dashboard 116; test:package passed for both tarballs (SDK build still emits dist); Playwright 125 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consolidated TypeScript configuration on one noEmit base with verbatimModuleSyntax and unused-code checks, made every workspace (dashboard included) extend it, and extended bun run typecheck to scripts/, playwright.config.ts and the dashboard config files; fixed the few errors the stricter settings surfaced. Verified with bun run check/test, test:package and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
