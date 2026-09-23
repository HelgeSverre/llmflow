---
id: TASK-86
title: Consolidate tsconfig files and make typecheck cover the whole repo
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
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
- [ ] #1 One base config with per-workspace extensions; no emit-related options in noEmit configs; one verbatimModuleSyntax setting
- [ ] #2 `bun run typecheck` covers apps/*, packages/*, scripts/, e2e/ and the root config files, and passes
<!-- AC:END -->
