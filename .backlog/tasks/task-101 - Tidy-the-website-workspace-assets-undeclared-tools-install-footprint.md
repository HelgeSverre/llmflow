---
id: TASK-101
title: 'Tidy the website workspace: assets, undeclared tools, install footprint'
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 09:55'
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
- [ ] #1 No duplicate images; every image under website/ is referenced by index.html or README; serve/vercel are declared devDependencies or invoked via bunx --package with pinned versions
- [ ] #2 Docker/CI installs pull nothing on behalf of website (or website is not a workspace)
- [ ] #3 website is not in the root workspaces list and bun install creates no website/node_modules; website commands still work via bunx
<!-- AC:END -->

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
