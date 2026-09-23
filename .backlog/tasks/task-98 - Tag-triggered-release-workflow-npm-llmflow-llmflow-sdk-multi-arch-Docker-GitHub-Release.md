---
id: TASK-98
title: >-
  Tag-triggered release workflow: npm (llmflow + llmflow-sdk), multi-arch
  Docker, GitHub Release
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 09:24'
labels:
  - release
  - ci
milestone: m-0
dependencies:
  - TASK-96
  - TASK-97
  - TASK-84
  - TASK-104
references:
  - RELEASING.md
  - .github/workflows
  - release-notes
  - justfile
priority: high
type: feature
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision: push a `vX.Y.Z` tag → GitHub Actions runs the checks, publishes `llmflow` and `llmflow-sdk` to npm with provenance, builds and pushes `helgesverre/llmflow:X.Y.Z` + `latest` for amd64+arm64, and creates a GitHub Release from `release-notes/vX.Y.Z.md`.
State today: releases are manual (`RELEASING.md`) and drifted — npm has 0.3.1/0.3.2/0.4.1, git tags stop at v0.3.2 (v0.3.1 points at a different commit than npm 0.3.1), GitHub "Latest" is v0.2.2, Docker tags mix `0.4.1` and `v0.3.2`, `release-notes/` has v0.4.0 (never published) and no v0.4.1. RELEASING.md tags before publishing (:30-34), uses `git add -A`, a `pkill` pattern that no longer matches (:83), `cd ..` that lands in packages/ (:279), and lists Node but not Bun as required.
Add `just release <version>`: bumps root + sdk versions, creates `release-notes/v<version>.md` from a template, commits, tags. Needs `NPM_TOKEN` and Docker Hub secrets (user action; document in RELEASING.md). Rewrite RELEASING.md around the new flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A `v*` tag triggers .github/workflows/release.yml which publishes both npm packages, pushes multi-arch Docker tags X.Y.Z and latest, and creates a GitHub Release with the notes file; a dry-run mode exists for testing
- [ ] #2 `just release 0.5.0` bumps versions in lockstep, creates the notes file, commits and tags; RELEASING.md describes only this flow and the required secrets
- [ ] #3 The next actual release fixes the published-artifact drift: Docker latest serves 1337, npm README image works, GitHub Latest matches npm
- [ ] #4 Both packages are published with bun publish (or bun pm pack + npm publish tarball) from their workspace directories, never from the root
- [ ] #5 just release turns release-notes/UNRELEASED.md into release-notes/v<version>.md and recreates an empty UNRELEASED.md
- [ ] #6 release.yml publishes via bun pm pack plus npm publish ./tarball --provenance with id-token: write; both package.json files carry a repository field matching the GitHub repo
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:06
---
Workspace decision (2026-09-23): apps/server becomes the published llmflow package and the root goes private (see the "Make apps/server the published llmflow package" task); website leaves the workspaces list. Adjust paths accordingly: dist/ and bin/ live under apps/server.
---

created: 2026-09-23 09:24
---
Verified 2026-09-23: bun publish has no --provenance or OIDC support (oven-sh/bun issues #15601, #22423 open; PR #29374 closed unmerged). Working path: bun install (pack takes workspace versions from bun.lock) then bun pm pack in the workspace dir (rewrites workspace: and catalog: in dependencies, devDependencies, peer and optional), then npm publish ./<tarball> --provenance with permissions id-token: write, npm >=9.5 and a public repository field in package.json that matches the GitHub repo. npm does not validate workspace: specs at publish time, only at install, so the tarball assertion in test:package is the real guard.
---
<!-- COMMENTS:END -->
