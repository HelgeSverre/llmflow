---
id: TASK-85
title: >-
  Remove every require() from TypeScript files and typecheck packages/providers
  on its own
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - typescript
milestone: m-0
dependencies:
  - TASK-80
  - TASK-81
  - TASK-82
  - TASK-83
  - TASK-84
references:
  - apps/server/src/server.ts
  - packages/db/src/index.ts
  - scripts/dev.ts
  - packages/providers
priority: high
type: task
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the package ports, delete the CJS boundary: `apps/server/src/server.ts:18-24` (7 requires), `proxy.ts:5-7`, `packages/db/src/index.ts:6`, `migrations.ts:2`, `scripts/dev.ts:69` (relative path into `../packages/otlp/src/export`, bypassing package exports), `apps/server/test/telemetry-regressions.test.ts:29-31`, `database-regressions.test.ts:8`; `e2e/playwright/start-test-server.js:37` and the e2e workspace (`type: commonjs`) → ESM. All 58 explicit `any` hotspots that came from untyped requires should disappear.
`packages/providers` has no tsconfig and no typecheck script; it is only checked because the server imports it. Give it both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 grep -rn "require(" across apps packages scripts e2e (excluding node_modules/dist) returns nothing
- [ ] #2 Every workspace has a tsconfig.json and a typecheck script that `bun run typecheck` runs
<!-- AC:END -->
