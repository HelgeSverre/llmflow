---
id: TASK-79
title: Add dashboard unit tests for the pure logic modules
status: Done
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 11:12'
labels:
  - tests
  - dashboard
milestone: m-0
dependencies: []
references:
  - apps/dashboard/src/lib/utils/format.ts
  - apps/dashboard/src/lib/trace/tree.ts
priority: low
type: task
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The dashboard has 8 Vitest files (stores, waterfall, debounce) but none for the pure helpers that every view depends on: `lib/utils/format.ts`, `lib/trace/tree.ts`, `components/trace-viewer/SpanColors.ts`, `stores/refresh.ts`, `stores/load-state.svelte.ts`, `lib/api/client.ts`. Keep the existing `mount`/`flushSync` pattern; no testing-library dependency needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 format.ts, tree.ts and load-state have vitest coverage for their branches (compact numbers, 8-decimal costs, tree building with missing parents, load-state transitions)
- [ ] #2 `bun run test:dashboard` passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added Vitest files: lib/utils/format.test.ts, lib/trace/tree.test.ts, stores/load-state.svelte.test.ts, stores/refresh.test.ts, components/trace-viewer/SpanColors.test.ts, lib/api/client.test.ts. Kept the existing mount/flushSync pattern; no testing-library dependency.
- The test:dashboard root script does not exist on main. TASK-76 plans to add it (along with test:server and test:live). I left it out here to avoid a merge conflict with TASK-76's package.json changes. AC #2 stays unchecked until that script exists; the equivalent command (cd apps/dashboard && bun run test, i.e. vitest run) passes: 14 files, 110 tests.
- tree.ts only flattens a tree the server has already built (flattenTraceTree); it does not build the tree itself. So 'missing parents' is covered as an orphan root that keeps its parent_id after flattening.
- Tests that use runes can be named *.svelte.test.ts: the vitest config's svelte plugin compiles $effect.root in them (see load-state.svelte.test.ts).
- load-state transitions are tested through loadModels, the smallest store that uses createLoadState, with $lib/api/client mocked the same way as in logs.test.ts.
- The worktree's git status showed nothing left uncommitted after the commit.
Merge gate on main: bun install, typecheck, root test (server), dashboard vitest (110/110), oxlint, oxfmt --check all green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added dashboard unit tests for format.ts (compact numbers, 8-decimal costs), tree.ts (flattening, orphan roots with missing parents), load-state (transitions via loadModels), refresh store, SpanColors and the api client. Verified on main after merge: dashboard vitest 14 files / 110 tests pass, plus typecheck, lint and format check. AC #2 refers to a root test:dashboard script that TASK-76 will add; it is not checked yet.
<!-- SECTION:FINAL_SUMMARY:END -->
