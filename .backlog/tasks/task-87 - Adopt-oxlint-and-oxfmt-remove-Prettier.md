---
id: TASK-87
title: Adopt oxlint and oxfmt; remove Prettier
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
labels:
  - lint
milestone: m-0
dependencies: []
references:
  - .prettierrc.json
  - .prettierignore
  - package.json
priority: high
type: chore
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision (2026-09-23): oxlint + oxfmt, remove eslint (none present) and prettier.

Today: no linter at all; `.prettierrc.json` (no semis, single quotes, tabWidth 4, 2 for `apps/dashboard/**`, md/json/yml); format only via justfile recipes, not checked in CI (`prettier --check .` currently fails on 4 files); `AGENTS.md:498` still says "run linting".

Verified against oxc docs on 2026-09-23: oxfmt 0.70.0 (beta) formats ts/js/json/css/yaml/toml natively and html/md/svelte through a bundled Prettier (needs Node; `"svelte": true` must be set explicitly, Svelte support is marked experimental, `svelte` ≥5 must be installed; Prettier plugins are not supported; `printWidth` defaults to 100). oxlint 1.85.0 lints `.svelte` `<script>` blocks only (no template rules, `env.svelte: true` declares the runes); `eslint-plugin-svelte` cannot run through jsPlugins yet; svelte-check stays the template safety net. `oxfmt --migrate=prettier` converts the existing .prettierrc.

Scope: `bun add -d oxlint@1.85.0 oxfmt@0.70.0` (pin), `.oxlintrc.json` (`$schema`, correctness+suspicious+typescript, `env.svelte`, ignorePatterns for dist/node_modules/.backlog/proto.json/pricing.fallback.json), `.oxfmtrc.json` migrated from .prettierrc with `printWidth` kept explicit and `"svelte": true`, root scripts `lint`, `lint:fix`, `format`, `format:check` and a combined `check` (typecheck + lint + format:check), justfile recipes, CI step, one formatting commit for the whole repo, then remove `prettier`, `.prettierrc.json` and `.prettierignore`. Optional: `oxlint-tsgolint` for type-aware rules (root config only) — evaluate, do not block on it. If Svelte formatting misbehaves, the documented fallback is `overrides: [{files: ["**/*.svelte"], options: {svelte: false}}]` plus prettier+prettier-plugin-svelte scoped to `**/*.svelte` only; record the outcome in the task notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `bun run lint` and `bun run format:check` pass on a clean tree and fail on an introduced violation (one .ts, one .svelte); both run in CI
- [ ] #2 prettier is no longer a dependency and no prettier config/ignore file remains, unless the task notes document the Svelte-only fallback
- [ ] #3 AGENTS.md/README describe the exact lint/format commands
<!-- AC:END -->
