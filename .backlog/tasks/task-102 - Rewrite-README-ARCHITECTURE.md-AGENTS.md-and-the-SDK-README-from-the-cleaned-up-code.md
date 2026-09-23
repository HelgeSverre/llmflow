---
id: TASK-102
title: >-
  Rewrite README, ARCHITECTURE.md, AGENTS.md and the SDK README from the
  cleaned-up code
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - docs
milestone: m-0
dependencies:
  - TASK-90
  - TASK-94
  - TASK-98
  - TASK-78
  - TASK-87
  - TASK-75
references:
  - README.md
  - ARCHITECTURE.md
  - AGENTS.md
  - packages/sdk/README.md
priority: high
type: docs
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Do this after the code tasks so it documents the end state. Known stale content (2026-09-23 audit):
- README: dev docs live below `## License` (:255+); test instructions repeated 5×; `:188` claims an unmatched-models indicator that does not exist; fallback wording implies broad offline coverage (14 models); config table misses ~10 vars (generate from the config module); `:13,55,226` tell users to open :1337 during `bun run dev` where the live UI is the Vite URL; bin/dist explanation duplicated with AGENTS 31-33 and ARCHITECTURE 99/576-597.
- ARCHITECTURE.md: anchors to old commits (5, 99, 414); "stream tee" (60) — no tee exists; `OTLP_EXPORT_ENDPOINT` scope (64, 557); DB file is data.db not llmflow.db (79); broken ref `index.ts-24` (104); nonexistent `getAnalytics`, `log.otlp` (140, 150, 554); `/api/traces/export` (291) does not exist while `/api/services`, replay, proxy `/health`/`/providers` are missing; WebSocket message names wrong (310, 443, 515); ER diagram outdated (394-407); `parent_id IS NULL` claim (412) false; module graph wrong (543).
- AGENTS.md: lines 63-806 (92%) are the generic Backlog.md manual using `backlog/` paths (repo uses `.backlog/`); `:5` workspaces list, `:7` `--hot`, `:12` typecheck description, `:498` "linting" all stale.
- `packages/sdk/README.md` require() examples (M5). `release-notes/v0.3.0.md:165-166` links to deleted docs/guides.
Also add the developer workflow: how to build, run dev, test, lint, release — matching the final justfile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every command in README/AGENTS/ARCHITECTURE exists and works as written (checked by running them); no reference to deleted files, dead functions or wrong ports
- [ ] #2 AGENTS.md is a short project-specific guide (< 150 lines) that points to `backlog --help` instead of embedding the manual
- [ ] #3 ARCHITECTURE.md routes, WebSocket messages, ER diagram and module graph match the code
<!-- AC:END -->
