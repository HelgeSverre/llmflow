---
id: TASK-92
title: Remove dashboard template leftovers and duplicated view logic
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 09:55'
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
- [ ] #1 No unreferenced component, asset, README boilerplate or dead CSS rule remains (verify each listed selector has no producer)
- [ ] #2 Span type, palette, severity normalisation and theme init are each defined once and imported
- [ ] #3 vitest.config extends vite.config (alias and plugin declared once); the Vite dev proxy is defined in one place
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:55
---
Done ahead of time (2026-09-23): Counter.svelte, svelte.svg, the boilerplate README and .gitignore are deleted. Remaining scope: dead CSS, duplicated span-type/severity/theme logic, vite/vitest config dedupe.
---
<!-- COMMENTS:END -->
