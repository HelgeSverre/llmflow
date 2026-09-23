---
id: TASK-71
title: Add repo hygiene files and stop shipping private or generated files
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 11:47'
labels:
  - hygiene
milestone: m-0
dependencies: []
references:
  - .gitignore
  - .dockerignore
  - docker/Dockerfile
priority: high
type: chore
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit (2026-09-23) found gaps in the ignore files and private data in the tree.

- `.gitignore`: missing `*.tgz` (plain `npm pack` drops a tarball in the root), `.env.*` (keep `.env.example`), `/public/` (old build output must not come back), `examples/*/bun.lock`; stale entries `codedb.snapshot`, `.compound-engineering`.
- `.dockerignore`: does not exclude `**/.idea`, `**/.DS_Store`, `**/.env`, `**/*.db` (root-only patterns don't match subdirs), `examples/` (incl. `examples/claude-code/.claude-config/` = real Claude Code transcripts + shell snapshot), `website/*.png`, `website/assets/`, `website/.vercel/` (org id), `.github/`, `*.tgz`. `website/package.json` must stay in the context (workspace, frozen lockfile).
- No `.editorconfig`.
- npm: keep the `files` whitelist in package.json (no `.npmignore`); document that choice.
- `.backlog/assets/` holds 90 tracked PNGs (6.1 MB) of screenshot evidence; `design-fixes-2026-09-22/` is not referenced by name anywhere.
- `examples/claude-code/.claude-config/` (untracked, 252 KB) contains private session data and must be deleted, not just ignored.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `.gitignore` covers *.tgz, .env.* (except .env.example), /public/, examples/*/bun.lock and has no stale entries
- [x] #2 `.dockerignore` excludes .idea, .DS_Store, .env, *.db at any depth plus examples/, website images/assets/.vercel, .github and *.tgz; `docker build -f docker/Dockerfile .` context contains no private files (verify with a dry-run listing)
- [x] #3 `.editorconfig` exists and matches the formatter settings
- [x] #4 examples/claude-code/.claude-config/ is deleted and unreferenced screenshot evidence under .backlog/assets is removed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged cleanup/task-71 into main (no conflicts).
Verified facts and decisions:
- .dockerignore also excludes **/.env.*, so .env.example is not in the image build context. The Dockerfile does not need it.
- The Docker build context is now only the root config files, bun.lock, apps/, packages/, e2e/ (needed so the frozen-lockfile workspace install works), scripts/ and docker/. TASK-97 can build on this.
- website/ is excluded entirely (it is not a workspace member), which covers website images, assets and .vercel.
- .claude/worktrees/ was already gitignored on main (4b16d56). It is now also excluded from the Docker context through .claude.
- AGENTS.md Conventions has a new line: npm packages ship through the package.json files whitelist and there is no .npmignore.
- No backlog files were edited: per comment #2 every .backlog/assets folder is referenced by name from tasks, so the assets stay. examples/claude-code/.claude-config/ is gone and stays ignored in both .gitignore and .dockerignore.
Validation: bun install, bun run typecheck, bun run lint, bun run format:check, bun run test (14 passed), dashboard vitest (113 passed) all green. Dry-run context listing (busybox COPY . + find) shows only the files above and no .env*, *.db, .DS_Store, .idea, node_modules or .claude-config. docker build -f docker/Dockerfile . succeeds.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Reconciled with TASK-101: once website leaves the workspaces list, .dockerignore should exclude website/ entirely (no package.json needed in the build context).
---

created: 2026-09-23 09:55
---
Correction (2026-09-23): every .backlog/assets folder is referenced by name from 15-25 tasks/docs, so nothing there is unreferenced; leave the assets alone. examples/claude-code/.claude-config has already been deleted locally; keep the .dockerignore rule so it can never re-enter a build context.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tightened .gitignore (*.tgz, .env.* except .env.example, /public/, examples/*/bun.lock; stale entries dropped), rewrote .dockerignore so the build context is only root config, bun.lock, apps/, packages/, e2e/, scripts/ and docker/ (private and generated files excluded at any depth), added .editorconfig matching .oxfmtrc.json, and documented the npm files-whitelist choice in AGENTS.md. Verified with typecheck, lint, format check, server and dashboard tests, a Docker context dry-run listing and a full docker build.
<!-- SECTION:FINAL_SUMMARY:END -->
