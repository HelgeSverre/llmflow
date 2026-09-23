---
id: TASK-104
title: >-
  Make apps/server the published llmflow package and the root a private
  workspace root
status: To Do
assignee: []
created_date: '2026-09-23 09:06'
labels:
  - workspaces
  - packaging
  - runtime
milestone: m-0
dependencies: []
references:
  - package.json
  - apps/server/package.json
  - scripts/build.ts
  - scripts/dev.ts
  - bin/llmflow.js
  - docker/Dockerfile
priority: high
type: task
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision (2026-09-23, after checking https://bun.com/docs/pm/workspaces): keep Bun workspaces, but follow the documented layout: the root is `"private": true` with only devDependencies + `catalog`, and every publishable thing is a workspace member.

Today the root `package.json` is both the workspace root and the published `llmflow` CLI (bin/, dist/, files, prepack). Because a published manifest cannot depend on private `@llmflow/*` packages, the root declares no workspace deps, so `scripts/dev.ts:67-69`, `scripts/build.ts:15-31` and `bin/llmflow.js:40` reach into `../apps/server/src/server`, `../packages/db/src/index`, `../packages/pricing/pricing.fallback.json` by relative path, bypassing the workspace graph (with the isolated linker the root has no `node_modules/@llmflow/*` at all).

Target:
- `apps/server` becomes package `llmflow` (version, `bin/llmflow.js`, `files: [bin/, dist/]`, `prepack` → its own `dist/` containing server bundle + dashboard + pricing fallback). Its `@llmflow/*` deps stay `workspace:*` but move to `devDependencies` (they are bundled; consumers must never see them). `e2e/playwright` depends on `llmflow` instead of `@llmflow/server`.
- Root: `private: true`, no `bin`/`files`/`prepack`/`version` duties, `devDependencies` may reference workspaces (`"llmflow": "workspace:*"` is allowed per Bun docs) for orchestration scripts; add `"catalog"` for versions shared by more than one workspace (today: typescript, @playwright/test).
- Dev/build orchestration lives where it can import without `../`: server-related scripts under `apps/server/scripts/` (dev, build, demo), root scripts only forward via `bun run --filter` (which runs in dependency order). No file may import another workspace by relative path.
- `website` leaves the `workspaces` list (separate decision, TASK-101).
- Publishing goes through `bun publish` (rewrites `workspace:`/`catalog:`), or `bun pm pack` + `npm publish <tarball> --provenance`; the packed manifest must contain no `workspace:` or `catalog:` specifier (assert in scripts/test-package.ts). CI uses `bun ci`.
- Docker copies `apps/server/dist`; `scripts/test-package.ts` packs `apps/server`.
This reworks parts of TASK-69 (Codex) which built dist/ at the root; do it before the packaging/release tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root package.json is private, has no bin/files/prepack, and declares only devDependencies and a catalog; bun install from a clean clone succeeds with the isolated linker
- [ ] #2 apps/server is the npm package llmflow: bun pm pack there yields a tarball with bin/ and dist/ only, no workspace: or catalog: specifiers, and test:package passes against it
- [ ] #3 No file imports another workspace via a relative path (grep for ../apps/ and ../packages/ across apps, packages, scripts, e2e returns nothing); root scripts forward with bun run --filter
- [ ] #4 Docker build, CI and bin/llmflow.js work from the new layout; typecheck, tests and Playwright pass
<!-- AC:END -->
