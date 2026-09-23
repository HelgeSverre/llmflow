---
id: TASK-101
title: 'Tidy the website workspace: assets, undeclared tools, install footprint'
status: Done
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 11:35'
labels:
  - website
milestone: m-0
dependencies:
  - TASK-104
references:
  - website/package.json
  - website/README.md
priority: low
type: chore
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task-68 made `website/` a root workspace with local scripts. Leftovers: `website/screenshot.png` is byte-identical to `screenshot-dark.png` and unreferenced; `website/assets/` (3.1 MB) is referenced only by `website/README.md`; the `website` scripts rely on `bunx serve` and `vc` which are declared nowhere; being a workspace its deps are installed in Docker/CI (check they are none or move it out of `workspaces`). `website/.vercel/project.json` must stay out of the Docker context (H1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No duplicate images; every image under website/ is referenced by index.html or README; serve/vercel are declared devDependencies or invoked via bunx --package with pinned versions
- [x] #2 Docker/CI installs pull nothing on behalf of website (or website is not a workspace)
- [x] #3 website is not in the root workspaces list and bun install creates no website/node_modules; website commands still work via bunx
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- website/assets/screenshot.png was not byte-identical to anything, but it showed the same light Logs view as screenshot-log-light.png, so it was deleted as an older copy.
- website/package.json is kept, with no dependencies, so `bun run --cwd website <script>` and the just website* recipes keep working unchanged.
- The og script depends on the root devDependency @playwright/test being installed; the website README says so.
- The .dockerignore entry `website` also covers the website/.vercel requirement (H1).
- To update the pinned tool versions (serve@14.2.6, vercel@59.25.4), edit website/package.json and website/README.md together.
- The relayed user request item "yes rename it" matched nothing in TASK-101, so nothing was renamed here.
- Merge validation on main: bun install (no website/node_modules created), typecheck, bun run test, dashboard tests (113 passed), lint, format:check and test:package all green. Every image under website/ is referenced by index.html or README.md, no duplicate hashes; bunx serve@14.2.6 and bunx vercel@59.25.4 resolve and report those versions.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:06
---
Decision (2026-09-23): remove website from the root workspaces list; run the OG-image script with the root Playwright via bunx. Delete website/node_modules and the website entry in bun.lock.
---

created: 2026-09-23 09:55
---
Done ahead of time (2026-09-23): website/screenshot.png (duplicate) deleted.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed website from the root workspaces (and its bun.lock entry), pinned serve/vercel via bunx in website/package.json (no dependencies), deleted the stale website/assets/screenshot.png, excluded website from the Docker context, and updated website/README.md. Verified with bun install (no website/node_modules), typecheck, server and dashboard tests, lint, format check, test:package, an image-reference/duplicate-hash check, and bunx version checks for the pinned tools.
<!-- SECTION:FINAL_SUMMARY:END -->
