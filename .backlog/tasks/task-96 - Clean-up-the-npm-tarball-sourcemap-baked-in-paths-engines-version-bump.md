---
id: TASK-96
title: 'Clean up the npm tarball: sourcemap, baked-in paths, engines, version bump'
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 09:06'
labels:
  - packaging
milestone: m-0
dependencies:
  - TASK-73
  - TASK-81
  - TASK-104
references:
  - scripts/build.ts
  - scripts/test-package.ts
  - package.json
priority: high
type: chore
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`npm pack --dry-run --ignore-scripts` today: 11 files, 309 kB packed / 1.5 MB unpacked. `dist/server.js.map` is 893 kB (58%) and never referenced because `sourcemap:'external'` adds no sourceMappingURL. `dist/server.js:1132` contains `var __dirname = "/Users/helge/code/llmflow/packages/pricing/src"` and 72 comment lines with local paths (set `root`/`sourcemap:'linked'` in `scripts/build.ts`, or drop the map). `engines` lacks node (launcher). Version 0.4.1 is already published from a pre-reorg commit, so the next release must be 0.4.2 or 0.5.0. README image path `art/screenshot-dark.png` is broken on the published npm page after `art/` was deleted; use an absolute URL. `scripts/test-package.ts` should also assert tarball size and that no `/Users/` string is in dist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tarball contains no sourcemap larger than the bundle (or a linked one) and no local filesystem paths; test:package asserts both
- [ ] #2 package.json version is bumped past 0.4.1 and engines include node; README image resolves on npmjs.com
- [ ] #3 The tarball is produced from apps/server and its package.json contains no workspace: or catalog: specifier
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:06
---
Workspace decision (2026-09-23): apps/server becomes the published llmflow package and the root goes private (see the "Make apps/server the published llmflow package" task); website leaves the workspaces list. Adjust paths accordingly: dist/ and bin/ live under apps/server.
---
<!-- COMMENTS:END -->
