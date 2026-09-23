---
id: TASK-87
title: Adopt oxlint and oxfmt; remove Prettier
status: Done
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 11:03'
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
- [x] #1 `bun run lint` and `bun run format:check` pass on a clean tree and fail on an introduced violation (one .ts, one .svelte); both run in CI
- [x] #2 prettier is no longer a dependency and no prettier config/ignore file remains, unless the task notes document the Svelte-only fallback
- [x] #3 AGENTS.md/README describe the exact lint/format commands
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- Svelte formatting: oxfmt 0.70.0 with "svelte": true works with the isolated linker; svelte 5 in apps/dashboard is enough. The Prettier-scoped-to-Svelte fallback was not needed. Output matches the old prettier-plugin-svelte output except for 2 small diffs in PricingFreshnessBanner.svelte and MetricsSummary.svelte, which were reformatted.
- `oxfmt --migrate=prettier` cannot migrate overrides (oxc issue #18215). It also wrote tabWidth 2 instead of 4, so .oxfmtrc.json was fixed by hand. sortPackageJson is false so package.json keys are not reordered.
- oxfmt reads .gitignore by default. The ignores from .prettierignore now live in .oxfmtrc.json ignorePatterns.
- Rules turned off in .oxlintrc.json as noise or false positives: no-shadow (16 hits), no-underscore-dangle (the _truncated/_spanName fields are real API contract names), no-unmodified-loop-condition (loop flags change inside closures in proxy.ts, run-tests.js and proxy-regressions.test.ts), unicorn/consistent-function-scoping, unicorn/prefer-add-event-listener, unicorn/no-array-sort and unicorn/no-array-reverse (all hits already sort a copy).
- no-unused-vars is set with argsIgnorePattern/varsIgnorePattern ^_, caughtErrors none and ignoreRestSiblings.
- oxlint lints only the <script> block of a .svelte file. A top-level unused variable there is not flagged because the template may use it. svelte-check, run by the dashboard typecheck, stays the template safety net.
- oxlint-tsgolint (type-aware rules) was not evaluated. It was optional in the task and can be a follow-up.
- For TASK-99 (CI hardening): checks.yml already has the `bun run lint` and `bun run format:check` steps.
- For TASK-103 (justfile rewrite): the justfile has lint, lint-fix, format, format-check and check recipes delegating to root scripts.
- Merge note: this commit touches several JS test files that other porting tasks may also change (apps/server/test/*.js, packages/sdk/index.js, examples/rag-pipeline/index.js). The edits are one-line deletions, so any merge conflicts should be small.
- Running Playwright rewrites PNGs under .backlog/assets/design-fixes-2026-09-22 and .backlog/assets/images. Restore them before committing.
- The relayed user lines "yes rename it" and "do not release anything" had nothing to rename in this task. Nothing was released, pushed or tagged.

Validation on main after merge (d852760): bun install, bun run typecheck (0 errors, svelte-check 0), bun run lint, bun run format:check, bun run test (all passed), dashboard vitest 40/40, Playwright 125/125. Introduced-violation probes: a .ts file and a <script> edit in App.svelte both made lint and format:check exit 1; probes reverted. prettier absent from all package.json and bun.lock; no .prettierrc/.prettierignore. README and AGENTS.md list the lint/format/check commands.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced Prettier with oxfmt 0.70.0 and added oxlint 1.85.0 (pinned). Added .oxlintrc.json and .oxfmtrc.json (hand-fixed after --migrate), root scripts lint, lint:fix, format, format:check and check, justfile recipes, and lint + format:check steps in checks.yml. Reformatted the repo once and removed prettier, .prettierrc.json and .prettierignore. Svelte formats through oxfmt's bundled Prettier, so the fallback was not needed. Verified on main with typecheck, lint, format:check, server tests, dashboard tests and Playwright (125/125). Introduced .ts and .svelte violations made lint and format:check fail.
<!-- SECTION:FINAL_SUMMARY:END -->
