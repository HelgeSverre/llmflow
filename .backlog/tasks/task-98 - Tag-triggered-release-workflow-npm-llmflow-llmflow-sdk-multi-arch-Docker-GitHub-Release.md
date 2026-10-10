---
id: TASK-98
title: >-
  Tag-triggered release workflow: npm (llmflow + llmflow-sdk), multi-arch
  Docker, GitHub Release
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-23 08:51'
updated_date: '2026-10-10 20:23'
labels:
  - release
  - ci
milestone: m-0
dependencies:
  - TASK-96
  - TASK-97
  - TASK-84
  - TASK-104
  - TASK-102
  - TASK-103
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
- [x] #2 `just release 0.5.0` bumps versions in lockstep, creates the notes file, commits and tags; RELEASING.md describes only this flow and the required secrets
- [ ] #3 The next actual release fixes the published-artifact drift: Docker latest serves 1337, npm README image works, GitHub Latest matches npm
- [x] #4 Both packages are published with bun publish (or bun pm pack + npm publish tarball) from their workspace directories, never from the root
- [x] #5 just release turns release-notes/UNRELEASED.md into release-notes/v<version>.md and recreates an empty UNRELEASED.md
- [x] #6 release.yml publishes via bun pm pack plus npm publish ./tarball --provenance with id-token: write; both package.json files carry a repository field matching the GitHub repo
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preflight npm, Docker Hub and GitHub publishing setup; use 0.5.0 because 0.4.1 is already published and this release changes API names.
2. Preserve the pre-existing pricing edit while preparing a clean release checkout; verify all checks, full tests including Python OTLP, live providers when configured, browser E2E and clean package installation.
3. Exercise a release workflow dry run and manual smoke checks of the built app (dashboard navigation, SDK/OTLP capture, proxy streaming and restart/migration).
4. Review release notes, prepare both packages and the annotated v0.5.0 tag, and bootstrap llmflow-sdk plus trusted publishing when authentication is available.
5. Push the release tag only after publishing prerequisites and checks pass; inspect the hosted workflow and published npm/Docker/GitHub artifacts, record evidence and finalize TASK-98.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
USER DECISION honoured: nothing was released, tagged or pushed (no git push at all in this run; main is 114 commits ahead of origin/main locally).
Done (commits 17a74b4, d347ed1):
- .github/workflows/release.yml: on push tags v* and workflow_dispatch (inputs version optional -> current package version; dry_run default true). Jobs: prepare (X.Y.Z check, both package.json versions == tag, release-notes/v<version>.md required unless dry run), checks (uses ./.github/workflows/checks.yml; checks.yml gained workflow_call), npm (permissions id-token: write; bun ci; bun pm pack in apps/server and packages/sdk; npm publish <tarball> --provenance --access public, plus --dry-run in dry runs; NODE_AUTH_TOKEN=secrets.NPM_TOKEN), docker (qemu + buildx, login only when publishing, build-push-action platforms linux/amd64,linux/arm64, tags X.Y.Z and latest, build-args VERSION/REVISION/CREATED, push only when not dry run), github-release (contents: write; gh release create vX --verify-tag --latest --notes-file release-notes/vX.md; skipped in dry runs). actionlint: no findings.
- scripts/release.ts / root script 'release' / just release <version> [--dry-run] (group release): semver check; version must be newer; both manifests must share the current version; main + clean tree (warnings in --dry-run); tag and notes file must not exist; UNRELEASED.md must have content. Bumps both package.json, runs bun install (bun.lock records workspace versions), writes release-notes/v<version>.md ('# LLMFlow v<version>' + UNRELEASED body without its heading/comments), resets UNRELEASED.md to a template, commits 'Release v<version>', creates annotated tag, prints the push command.
- Verified in a throwaway clone (then deleted): just release 0.5.0 bumped both packages and bun.lock, wrote v0.5.0.md, reset UNRELEASED.md, one commit + annotated tag, clean tree; bun pm pack in both workspace dirs produced llmflow-0.5.0.tgz and llmflow-sdk-0.5.0.tgz. Rejections checked: 0.4.1 (not newer), 1.0 (not X.Y.Z), bare 'just release' (usage).
- The recipe takes *args so recipe-contracts can dry-run it bare (a required parameter failed that test; fixed in d347ed1).
- RELEASING.md written from scratch (flow, rehearsal, secrets NPM_TOKEN / DOCKERHUB_USERNAME / DOCKERHUB_TOKEN, first-release drift checklist); README Packaging links it. Both package.json repository fields match github.com/HelgeSverre/llmflow.
REMAINING (need the user; both require pushing, which was withheld):
- AC1: push the workflow and run Actions -> Release -> Run workflow (dry_run) once to see it green on GitHub; add the three secrets first for a real release.
- AC3: cut the first real release (0.5.0 suggested; 0.4.1 is taken on npm) and walk the RELEASING.md drift checklist (npm versions + README image, Docker latest on 1337, GitHub Latest).

Change (2026-09-23, user decision: no npm token in CI): release.yml now publishes through npm trusted publishing. Removed NODE_AUTH_TOKEN/NPM_TOKEN and --provenance (npm adds provenance automatically under OIDC); added 'npm install -g npm@^11.5.1' (trusted publishing needs npm >= 11.5.1 and Node >= 22.14; Node 22 ships npm 10); kept id-token: write. The publish loop skips a name@version already on npm (checked with npm view; tested locally: llmflow@0.4.1 -> skip). Verified in npm docs (docs.npmjs.com/cli/v11/commands/npm-trust): 'Package must exist: The package you're configuring must already exist on the npm registry.' So llmflow (on npm) only needs its trusted publisher configured; llmflow-sdk (npm view -> 404, never published) needs one manual first publish from a logged-in machine, then its trusted publisher; RELEASING.md documents both. Only Docker Hub secrets remain. AC6 wording ('--provenance') is superseded: provenance is automatic with trusted publishing.

2026-10-10: User now explicitly authorized verification and a new release, superseding the earlier no-push/no-publish instruction. Target 0.5.0. Registry preflight: llmflow latest is 0.4.1; llmflow-sdk returns 404; npm whoami on this machine returns 401; gh secret list returned no repository secrets. Requested npm login, llmflow trusted publisher, and Docker Hub repository secrets from the user while continuing release preparation. Main 7feef88 passed hosted Checks. Pre-existing pricing.fallback.json edit remains separate until reviewed/preserved for release preparation.

Live provider suite passed: 15 real calls across OpenAI, Anthropic, Gemini, Groq, Mistral and Cohere; Together, Azure and local Ollama skipped because their configuration was unavailable. Release dry-run dispatched on main 7feef88: https://github.com/HelgeSverre/llmflow/actions/runs/38083090689. Reviewed the pre-existing pricing edit: generated LiteLLM snapshot dated 2026-09-24, 801 models, valid schema and finite nonnegative token rates; include this existing data update in the clean release preparation rather than discarding it. Latest Checks for main 7feef88 are green: https://github.com/HelgeSverre/llmflow/actions/runs/38082696584.

Hosted release rehearsal passed at https://github.com/HelgeSverre/llmflow/actions/runs/38083090689: prepare, full checks/Python/unit/browser/package gates, both Docker platform smoke jobs, npm dry-run and multi-architecture release-image build all succeeded; GitHub release correctly skipped. Publishing access remains unavailable (npm whoami still 401, no Docker Hub repository secrets). Reviewed the notes and corrected the removed cost-by-tool endpoint replacement to by_service, matching current /api/analytics. Bundled-pricing tests (6) and bun run check passed with the 801-model snapshot.

Prepared Release v0.5.0 at local annotated tag v0.5.0 / commit 9eaae70. Both manifests and bun.lock move in lockstep, v0.5.0 notes were generated and UNRELEASED reset. Pre-existing generated pricing snapshot included at f0ccd2f. Fresh verification on exact v0.5.0 passed: bun run check; LLMFLOW_PYTHON=/tmp/llmflow-release-verify.l8UvR4/python/bin/python bun run test (230 server/package + 116 dashboard, no skips/failures); production build; both clean-package gates; 125 Playwright tests (45.2s). Live suite earlier passed 15/18, with unavailable Together/Azure/Ollama skipped.

Temporary built-app smoke script at /tmp/llmflow-release-verify.l8UvR4/smoke.ts passed against dist/server.js with a fresh isolated database: SDK root/tool spans and two Ollama-format mock proxy calls (nonstreaming + streaming), unique span/parent links, 142 measured tokens, credential/query redaction, session descendant totals through explicit session_id ingestion, OTLP observed-time logs and numeric metrics, all seven dashboard tabs, nested waterfall, no browser page errors, desktop/mobile screenshot inspection. SDK custom attributes remain attributes; the harness explicitly annotated session_id through the supported API instead of expecting automatic attribute promotion. CLI reports llmflow v0.5.0. Local arm64 Docker 0.5.0 image started with numeric uid 1000, both /api/health and proxy /health worked, UI served and 801-model offline pricing was available; removed the owned container and smoke image.

Ready tarballs: /tmp/llmflow-release-verify.l8UvR4/packages/llmflow-0.5.0.tgz and /tmp/llmflow-release-verify.l8UvR4/packages/llmflow-sdk-0.5.0.tgz. Full-test/e2e/Docker build logs and screenshots remain in that temporary directory for this release. Only release preparation/main is pushed; v0.5.0 has not been pushed, no npm/Docker/GitHub release published. Publishing prerequisites still missing: npm whoami is 401, no NPM_TOKEN/NODE_AUTH_TOKEN or Docker Hub credentials are present, and gh secret list returns none. User was asked to log into npm, trust release.yml for llmflow and add DOCKERHUB_USERNAME/DOCKERHUB_TOKEN. Once ready: bootstrap the packed SDK, configure its trusted publisher, push v0.5.0, inspect release jobs and verify the published artifacts; do not mark AC1/AC3 complete beforehand.
<!-- SECTION:NOTES:END -->

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

created: 2026-09-23 09:55
---
RELEASING.md was deleted on 2026-09-23 because it described a broken flow; this task recreates it from scratch around release.yml and just release.
---

created: 2026-09-23 10:31
---
Decision (2026-09-23): no npm publishing from CI until the whole cleanup is done. This task is the last one in the milestone; it also writes RELEASING.md and adds the release recipe to the justfile and the release section to README after those were rewritten.
---
<!-- COMMENTS:END -->
