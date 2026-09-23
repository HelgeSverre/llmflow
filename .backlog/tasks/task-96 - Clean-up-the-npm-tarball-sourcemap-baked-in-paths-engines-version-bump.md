---
id: TASK-96
title: 'Clean up the npm tarball: sourcemap, baked-in paths, engines, version bump'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 19:32'
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
- [x] #1 Tarball contains no sourcemap larger than the bundle (or a linked one) and no local filesystem paths; test:package asserts both
- [x] #2 The tarball is produced from apps/server and its package.json contains no workspace: or catalog: specifier
- [x] #3 engines include node and the README image resolves on npmjs.com; the version number itself is changed only by the release recipe (TASK-98)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- Source map: kept and linked (Bun.build sourcemap 'linked' in apps/server/scripts/build.ts); dist/server.js ends with //# sourceMappingURL=server.js.map. The map is still larger than the bundle (856 kB vs 475 kB) but is now used by Bun for stack traces; its 85 sources are relative paths (no /Users/, no home directory).
- Build-machine paths: none in dist since TASK-81 removed the pricing __dirname. scripts/test-package.ts now scans every file of the installed package for the checkout path, os.homedir() and /Users/<name>/, and was proven to fail by planting a path into dist (then rebuilt clean).
- Size limits in test:package: packed tarball under 700 kB (currently ~308 kB), unpacked under 3 MB (~1.5 MB).
- AC2 was already covered: bun pm pack from apps/server, and test-package rejects workspace:/catalog: specifiers in the packed manifest.
- engines already had node (>=18 for the launcher) since TASK-73/104; version stays 0.4.1 — TASK-98's release recipe bumps it (0.4.1 is already published, so the next release must be 0.4.2 or 0.5.0).
- README image: https://raw.githubusercontent.com/HelgeSverre/llmflow/main/website/screenshot-dark.png (renders on GitHub and npmjs.com; the relative path broke on npm).
Validation: bun run check green; bun run test 228 pass/1 skip + dashboard 116; bun run test:package passed (both tarballs).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:06
---
Workspace decision (2026-09-23): apps/server becomes the published llmflow package and the root goes private (see the "Make apps/server the published llmflow package" task); website leaves the workspaces list. Adjust paths accordingly: dist/ and bin/ live under apps/server.
---

created: 2026-09-23 09:16
---
Verified empirically (Bun 1.4.2, 2026-09-23): Bun.build sourcemap "linked" is valid and adds a sourceMappingURL comment; import.meta.dir/path stay runtime-evaluated (not baked); a JSON import with type json is inlined into the bundle; the "// path" comments Bun emits are relative to the build cwd, so building from the repo root yields relative comments (the root option only changes the outdir layout and does not affect them). The only absolute-path leak was the CJS __dirname in pricing, removed by TASK-81. So: build from the repo root, decide linked-vs-none for the map by size, and assert no /Users/ string in dist.
---

created: 2026-09-23 09:24
---
Docs nuance: bun.com/docs/bundler/minifier says import.meta properties are inlined at build time when known, and issues #4216/#15994 report baked __dirname; the empirical test above (target bun, no minify) kept import.meta runtime-evaluated. Do not rely on either: TASK-81 removes all path resolution from the bundle by embedding the JSON, and test:package asserts no build-machine path in dist.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Linked the server source map, confirmed no build-machine paths ship and made test:package assert that (proven by a planted path), added tarball size limits, and switched the README screenshot to an absolute URL for npmjs.com; engines and the workspace-specifier check were already in place. Verified with bun run check/test and test:package.
<!-- SECTION:FINAL_SUMMARY:END -->
