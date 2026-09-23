---
id: TASK-92
title: Remove dashboard template leftovers and duplicated view logic
status: Done
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 11:16'
labels:
  - dashboard
  - dead-code
milestone: m-0
dependencies: []
references:
  - apps/dashboard/src/app.css
  - apps/dashboard/vite.config.ts
  - apps/dashboard/vitest.config.ts
priority: medium
type: chore
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- Vite template leftovers: `src/lib/Counter.svelte`, `src/assets/svelte.svg` (no importers), `apps/dashboard/README.md` (create-vite text mentioning nonexistent global.d.ts/jsconfig.json), boilerplate `apps/dashboard/.gitignore`, empty `apps/dashboard/public/`.
- Dead CSS in `src/app.css`: `.span-tree`/`.span-node*` (715-739), `.type-badge` + `.type-trace/log/metric` (811-828), `.related-log-*` (834-852), `.model-badge` (655), `.metric-name-cell` (645), `.tool-proxy` (1048).
- Span-type classification 3× (`TracesTable.svelte:13-22`, `TimelineList.svelte:13-20`, `SpanColors.ts:14-21`) with two palettes (`app.css:453-484` vars vs hex in `SpanColors.ts:3-12`). Severity class 2× (`LogsTable.svelte:7-16` normalises, `TimelineList.svelte:78` lowercases, so "WARNING" gets an unstyled class). Theme init 2× (`index.html:11-19`, `theme.svelte.ts:3-10`).
- Config: `$lib` alias defined in `vite.config.ts:10`, `vitest.config.ts:8` and `tsconfig.app.json`; `svelte()` plugin set up twice; `vite.config.ts:17-25` dev proxy is overridden by `apps/dashboard/dev.ts:84`. `stores/refresh.ts` and `load-state.svelte.ts` are not stores. `__fixtures__/WaterfallHarness.svelte` lives in `src/lib` so svelte-check includes it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No unreferenced component, asset, README boilerplate or dead CSS rule remains (verify each listed selector has no producer)
- [x] #2 Span type, palette, severity normalisation and theme init are each defined once and imported
- [x] #3 vitest.config extends vite.config (alias and plugin declared once); the Vite dev proxy is defined in one place
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged to main (merge 22d70fb) plus integration fix 79e3c5a: TASK-79's tests moved with the files (stores/refresh.test.ts -> src/lib/refresh.test.ts, stores/load-state.svelte.test.ts -> src/lib/load-state.svelte.test.ts, imports/mocks repointed to ./stores/*), and components/trace-viewer/SpanColors.test.ts removed in favour of utils/badges.test.ts (added the "first known type wins" case, agent_llm -> llm).

Visible changes:
- Trace rows whose span_type matches no known type now use the grey 'custom' badge. They used to fall back to the blue 'trace' class, and .span-trace no longer exists.
- Timeline badges for trace items are now coloured by span type (from item.data.span_type). They used to always be 'llm'. Log items still use the 'chain' colour.
- Badge colours change a little because they are now tinted from the Okabe-Ito palette (the waterfall bars already used it). Severity colours now come from the --text-muted, --accent-primary, --success, --warning and --error variables.

File moves: the dashboard files moved to src/lib/refresh.ts, src/lib/load-state.svelte.ts and src/lib/theme.ts. SpanColors.ts became src/lib/utils/badges.ts, which already has tests. TASK-79's description still gives the old paths (components/trace-viewer/SpanColors.ts, stores/refresh.ts, stores/load-state.svelte.ts), and its SpanColors coverage is partly done by badges.test.ts.

Preview script dropped: apps/dashboard no longer has a "preview" script. `vite preview` depended on the proxy that was removed, and the server serves the built dashboard itself.

Waterfall test fixture: __fixtures__/WaterfallHarness.svelte stays in src/lib/trace. It is not required by the acceptance criteria, and keeping it lets svelte-check typecheck the fixture.

Playwright pitfall: e2e/playwright/design-sweep.spec.js overwrites tracked PNGs in .backlog/assets/design-fixes-2026-09-22/ every run. Revert them before committing, or point that evidence path somewhere untracked (a possible follow-up).

Unrelated leftover: tsconfig.app.json still has the create-vite comment block about allowJs/checkJs.

Verification on main after merge: bun install; bun run typecheck (svelte-check 0 errors); bun run test (server, all passed); dashboard vitest 14 files / 113 tests passed; oxfmt --check and oxlint --deny-warnings clean; bun run build ok; Playwright 125 passed. Grep confirms none of the dead selectors (span-tree, span-node, type-badge, type-trace, related-log-, model-badge, metric-name-cell, tool-proxy, span-trace) remain in src/ or index.html; Counter.svelte, src/assets, README.md and .gitignore are gone; vitest.config.ts mergeConfig()s vite.config.ts; the dev proxy exists only in dev.ts; theme init is only the inline index.html script (theme.ts only toggles).

Nothing was released, pushed or tagged. The branch is left detached.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:55
---
Done ahead of time (2026-09-23): Counter.svelte, svelte.svg, the boilerplate README and .gitignore are deleted. Remaining scope: dead CSS, duplicated span-type/severity/theme logic, vite/vitest config dedupe.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the Vite template leftovers and dead CSS, and deduplicated the dashboard view logic: span-type classification, palette and severity normalisation now live once in src/lib/utils/badges.ts; theme init happens only in index.html; vitest.config extends vite.config; the dev proxy is only in dev.ts. Moved refresh/load-state/theme out of stores/. Merged to main with a small integration fix that moves TASK-79's tests to the new paths. Verified with typecheck, server tests, dashboard vitest (113 passed), lint/format checks, build and Playwright (125 passed).
<!-- SECTION:FINAL_SUMMARY:END -->
