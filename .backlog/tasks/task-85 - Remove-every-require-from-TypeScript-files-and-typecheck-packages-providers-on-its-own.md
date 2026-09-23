---
id: TASK-85
title: >-
  Remove every require() from TypeScript files and typecheck packages/providers
  on its own
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 18:28'
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
- [x] #1 grep -rn "require(" across apps packages scripts e2e (excluding node_modules/dist) returns nothing
- [x] #2 Every workspace has a tsconfig.json and a typecheck script that `bun run typecheck` runs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the remaining require()s (one TS test; all of e2e). 2. Convert e2e to TS ESM with its own tsconfig/typecheck and fix the type errors properly. 3. tsconfig + typecheck for packages/providers; type its tests. 4. Gate + Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- After TASK-80..84 only one TS require() was left (apps/server/test/env-example.test.ts, now await import). AC1 greps all file types, so e2e/playwright (CJS JS) was converted as well: all specs, seed-data and start-test-server are .ts ESM, package type: module, playwright.config.ts webServer runs 'bun e2e/playwright/start-test-server.ts'. start-test-server imports @llmflow/db dynamically after setting DATA_DIR/DB_PATH and resolves llmflow with Bun.resolveSync.
- Workspaces with tsconfig + typecheck (all run by bun run typecheck): llmflow, @llmflow/dashboard, db, dev-runtime, otlp, pricing, providers (new), shared, llmflow-sdk, @llmflow/e2e (new).
- Typing the e2e seed exposed a real bug: seed-data passed JSON.stringify(...) strings for request/response headers+bodies, tags, attributes and resource_attributes; insertTrace/insertLog encode those themselves, so rows were double-encoded and sanitizeHeaders split header strings into characters. The seed now passes objects (82 fields); all 125 Playwright tests pass on the corrected data.
- Found while converting: review-fixes.spec and design-sweep.spec wrote screenshots into .backlog/assets on every run, and four 'backlog: TASK-xx done' commits in this session had picked up regenerated .backlog/assets/images/fixed-*.png. Restored the originals (commit e0454b6) and moved both specs' screenshots to test.info().outputPath() (test-results/, gitignored).
- packages/providers tests use request() helpers that fill required ProviderRequest/PassthroughRequest fields; PassthroughRequest is now exported. Remaining explicit 'any' in non-test source (~12) are all JSON-parsing sites in stream.ts/traces.ts/sdk, none from require(); apps/server/src has none.
- Playwright on Node 26 prints DEP0205 (module.register) from its TS loader; harmless.
Validation: grep -rn 'require(' apps packages scripts e2e (excl. node_modules/dist) = 0; bun run check green (10 workspaces typecheck); bun run test 216 pass/1 skip + dashboard 116; Playwright 125 passed; .backlog/assets untouched after the run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the last require() and converted the e2e workspace to TypeScript ESM with its own typecheck; gave packages/providers a tsconfig and typed its tests. Along the way fixed double-encoded e2e seed data and stopped e2e runs from overwriting .backlog evidence screenshots. Verified with a zero-hit require() grep, bun run check (all 10 workspaces), bun run test and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
