---
id: TASK-73
title: 'Declare and pin the runtimes: Bun for the server, Node only for the npx shim'
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 11:39'
labels:
  - runtime
milestone: m-0
dependencies: []
references:
  - package.json
  - docker/Dockerfile
  - .github/workflows/checks.yml
  - bin/llmflow.js
priority: high
type: chore
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision: Bun-only server, `bin/llmflow.js` stays a Node launcher so `npx llmflow` works and prints "Bun is required" clearly.

Today nothing states this honestly and versions are unpinned/understated:
- `package.json` `engines` lists only `bun >=1.1.0` (text `bun.lock` needs ≥1.1.39; `@types/bun` is 1.3.x; local Bun is 1.4.2). No `engines.node` although the launcher, Playwright and `npm pack` need Node; Vite 8 needs Node ^20.19 || >=22.12.
- Docker uses floating `oven/bun:1`; CI `setup-bun@v2` has no version; no `.bun-version`/`packageManager`.
- Root devDeps declare both `@types/bun` and `bun-types` (`package.json:60-61`); `tsconfig.base.json` uses `bun-types`.
- `RELEASING.md:329-344` lists Node 18+ and npm as required tools and never mentions Bun.
- Vite/vitest/tsc/prettier run on Node when Node is on PATH (they follow the bin shebang) and on Bun inside Docker; make this explicit in docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.json declares realistic engines for bun and node; a .bun-version (or packageManager) file exists and Dockerfile, CI and docs all pin/read the same Bun version
- [x] #2 Only @types/bun remains; typecheck passes
- [ ] #3 README and RELEASING state in one sentence what needs Bun and what needs Node
- [x] #4 engines.bun is >=1.3.13 and .bun-version, setup-bun (bun-version-file) and the Dockerfile tag all name the same 1.4.x release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged cleanup/task-73 into main (clean merge). Gate on main: bun install, bun run check (typecheck + oxlint + oxfmt --check), bun run test (14 passed), dashboard vitest (113 passed), bun run test:package (tarball, CLI and missing-Bun checks passed).

Decisions and follow-ups:
- AC #3 is only half met: README has the Bun/Node runtime sentence, but RELEASING.md is not in the repo. TASK-98 must include the Bun/Node runtime sentence when it recreates RELEASING.md. Suggested wording: "Bun >= 1.3.13 (pinned in .bun-version) for install/build/test/publish; Node ^20.19 || >=22.12 only for the npx launcher and Node-shebang dev tools."
- TASK-96 (engines include node): apps/server/package.json already declares engines.node ">=18", since the launcher uses only node:child_process, fs, url and path in ESM. TASK-96 only needs to confirm that range, or tighten it if a Node LTS policy is wanted.
- TASK-97/TASK-99: the Dockerfile tag is the literal oven/bun:1.4.2, with a comment saying to keep it in sync with .bun-version. CI setup-bun uses bun-version-file: .bun-version. Nothing checks automatically that the Dockerfile tag, .bun-version and engines.bun agree; TASK-99 could add a small script check if wanted.
- Bumping Bun means editing .bun-version and the two FROM lines in docker/Dockerfile.
- The @types/bun package still pulls in bun-types transitively; that is expected.
- Nothing was released: nothing pushed, tagged or published, and the local Docker test image was deleted.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:24
---
Verified 2026-09-23: features this milestone relies on shipped in Bun 1.2.14 (catalogs), 1.2.19 (bun ci, isolated linker), 1.3.2 (isolated default via configVersion 1), 1.3.11 (bun test --path-ignore-patterns), 1.3.13 (bun test --isolate/--parallel). So engines.bun must be >=1.3.13; pin 1.4.2 in .bun-version. Bun itself reads neither .bun-version nor packageManager (github.com/oven-sh/bun/discussions/10955), but oven-sh/setup-bun supports bun-version-file (.bun-version, .tool-versions, package.json packageManager) and otherwise falls back to packageManager, then engines.bun, then latest. Docker: oven/bun tags 1.4.2, 1.4.2-slim, 1.4.2-alpine, 1.4.2-distroless exist.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pinned Bun 1.4.2 in .bun-version (read by CI via setup-bun bun-version-file and mirrored in both docker/Dockerfile FROM lines), declared engines bun >=1.3.13 and node ^20.19.0 || >=22.12.0 at the root (apps/server keeps node >=18 for the launcher), dropped bun-types in favour of @types/bun, and added a README sentence on what needs Bun vs Node. Verified on main with typecheck, lint, format check, server tests, dashboard tests and test:package. AC #3 remains open for RELEASING.md, which TASK-98 recreates.
<!-- SECTION:FINAL_SUMMARY:END -->
