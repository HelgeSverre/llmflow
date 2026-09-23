---
id: TASK-104
title: >-
  Make apps/server the published llmflow package and the root a private
  workspace root
status: Done
assignee: []
created_date: '2026-09-23 09:06'
updated_date: '2026-09-23 11:27'
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
- [x] #1 Root package.json is private, has no bin/files/prepack, and declares only devDependencies and a catalog; bun install from a clean clone succeeds with the isolated linker
- [x] #2 apps/server is the npm package llmflow: bun pm pack there yields a tarball with bin/ and dist/ only, no workspace: or catalog: specifiers, and test:package passes against it
- [x] #3 No file imports another workspace via a relative path (grep for ../apps/ and ../packages/ across apps, packages, scripts, e2e returns nothing); root scripts forward with bun run --filter
- [x] #4 Docker build, CI and bin/llmflow.js work from the new layout; typecheck, tests and Playwright pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- In Bun 1.4.2, plain `bun run --filter A --filter B script` runs in dependency order and waits for a dependency's script to exit. Since llmflow devDepends on @llmflow/dashboard, a combined dev run would block, so root `dev` uses `bun run --parallel --filter llmflow --filter @llmflow/dashboard dev`. When one `--parallel` script fails, bun sends SIGINT to the others and exits with the failing code. The dev-startup tests rely on this.
- The root is named `llmflow-workspace`. bun install does NOT update the root workspace name already in bun.lock, so it was changed by hand; `bun install --frozen-lockfile` / `bun ci` accept it.
- A new workspace `packages/dev-runtime` (@llmflow/dev-runtime, TS ESM, typecheck script) owns dev-server discovery. The state directory is keyed by the checkout root, computed from the file's realpath with fileURLToPath rather than import.meta.dir so the dashboard's node-typed tsconfig.node.json accepts it. The hash value is the same as before. apps/dashboard/tsconfig.node.json now includes dev.ts.
- apps/server/scripts/dev.ts supports server|demo|status only (no 'all'). The dashboard runs its own `bun dev.ts`, and the two find each other through the state directory. Root has a new `dev:status` script; justfile `status` calls it.
- apps/server `start` is now `bun bin/llmflow.js`, matching the old root behaviour. The old apps/server `start` ran src/server.ts directly. TASK-75 still has to decide source-vs-dist for start.
- prepack in apps/server: `bun run build && cp ../../README.md ../../LICENSE .`; postpack removes the copies. Both copies are gitignored. .dockerignore excludes README.md, which is why the copy is not part of build.ts.
- licenses/ moved to apps/server/licenses and bin/ to apps/server/bin.
- New package exports: @llmflow/providers ./stream, @llmflow/db ./migrations, @llmflow/otlp ./timestamps (used by the server tests).
- The e2e workspace now depends on both `llmflow` (to locate dist/server.js) and `@llmflow/db` (for seeding). With the isolated linker, e2e can only see its direct dependencies, so it still needs @llmflow/db.
- The tarball still has the 893 kB server.js.map, and engines has no node entry (TASK-96).
- The Dockerfile only changed its COPY path; it still uses `bun install --frozen-lockfile` and runs as root (TASK-97 covers bun ci and hardening).
- website is still in the root workspaces list and now uses `"@playwright/test": "catalog:"`. TASK-101 must replace that with a real version when website leaves the workspaces.
- Running Playwright rewrites PNGs under .backlog/assets; restore them before committing.
- The relayed user lines: "yes rename it" was applied as renaming the root package to llmflow-workspace so the name llmflow belongs to apps/server; "do not release anything" was followed (nothing pushed, tagged or published; the local Docker test image was deleted).

Merge to main: one conflict in apps/dashboard/tsconfig.node.json (main/TASK-92 added vitest.config.ts, this branch added dev.ts); resolved as include ["vite.config.ts", "vitest.config.ts", "dev.ts"].
Gate on merged main: bun install --frozen-lockfile, typecheck (all workspaces + scripts), lint, format:check, bun run test, dashboard vitest (113 tests), test:package, Playwright (125 passed) all green. A fresh clone ran bun install --frozen-lockfile and bun ci successfully, and apps/server/bin/llmflow.js --version worked from source there. Grep for ../apps/ and ../packages/ across apps, packages, scripts and e2e found nothing. docker build -f docker/Dockerfile succeeded and the container served the dashboard (HTTP 200 on 1337); the test image was deleted afterwards. The GitHub Actions workflow itself was not run (nothing pushed), but each of its steps was run locally.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Clarifications: (1) root may keep orchestration scripts that import no workspace code, e.g. bun test with explicit paths, bunx playwright, scripts/test-package.ts. (2) The combined dev command must not import apps/dashboard from apps/server or vice versa; the root dev script runs both workspace dev scripts via bun run --filter, and the dashboard discovers the server port through the existing state file/env mechanism from scripts/dev-runtime.ts, which moves into the workspace that owns it. (3) The @llmflow/* devDependencies of apps/server are still installed by bun install (workspace devDeps are installed), so e2e seeding through the llmflow package keeps working.
---

created: 2026-09-23 09:24
---
Verified 2026-09-23: bun pm pack rewrites workspace: and catalog: specifiers in all four dependency groups (src/runtime/cli/pack_command.rs, same code path as bun publish). The replacement version is read from bun.lock, so run bun install before packing; a missing or stale lockfile makes pack fail with "Failed to resolve workspace version". Keep the no-workspace:/catalog: assertion in test:package regardless.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
apps/server is now the published llmflow package (bin/, dist/, prepack building server bundle + dashboard + pricing fallback; @llmflow/* as bundled devDependencies). The root is the private llmflow-workspace with a catalog, and its scripts forward via bun run --filter (dev uses --parallel). Dev-server discovery moved into the new @llmflow/dev-runtime workspace, and no file imports another workspace by relative path. Docker, test:package and e2e use the new layout. Verified on merged main: typecheck, lint, format, server tests, dashboard tests, test:package, Playwright (125), bun ci on a fresh clone, and a local Docker build/run. Nothing was released.
<!-- SECTION:FINAL_SUMMARY:END -->
