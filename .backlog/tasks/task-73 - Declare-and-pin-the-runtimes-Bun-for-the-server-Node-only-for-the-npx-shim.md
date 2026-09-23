---
id: TASK-73
title: 'Declare and pin the runtimes: Bun for the server, Node only for the npx shim'
status: To Do
assignee: []
created_date: '2026-09-23 08:50'
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
- [ ] #1 package.json declares realistic engines for bun and node; a .bun-version (or packageManager) file exists and Dockerfile, CI and docs all pin/read the same Bun version
- [ ] #2 Only @types/bun remains; typecheck passes
- [ ] #3 README and RELEASING state in one sentence what needs Bun and what needs Node
<!-- AC:END -->
