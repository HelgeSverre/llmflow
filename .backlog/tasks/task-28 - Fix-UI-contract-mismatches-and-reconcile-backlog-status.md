---
id: TASK-28
title: Fix UI contract mismatches and reconcile backlog status
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 09:31'
updated_date: '2026-09-21 09:44'
labels: []
dependencies: []
documentation:
  - .backlog/docs/doc-1 - Backlog-reconciliation-—-2026-09-21.md
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Resolve audited dashboard findings and align all existing backlog tasks with current implementation and verification evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Metric values and summaries render actual API fields, including histogram aggregates and zero values.
- [x] #2 Unsupported timeline metric paths, unused helpers and unused date-filter state are removed.
- [x] #3 Refresh and tab shortcuts work for every active tab without breaking browser or input shortcuts.
- [x] #4 Missing durations remain distinct from zero in lists and span detail; only geometry uses zero defaults.
- [x] #5 All backlog tasks are reviewed; inaccurate status, acceptance criteria, descriptions, references and superseded proposals are reconciled without claiming unfinished work complete.
- [x] #6 Typechecks, targeted regressions and browser tests assert displayed values and interactions; production assets are rebuilt.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Match metric rendering to the actual list/summary API and assert measured values in browser tests. 2. Remove unsupported timeline branches and unused helpers/filter state; preserve nullable duration while defaulting only geometry. 3. Connect active-tab refresh and data-driven tab shortcuts, respecting editable targets and modifiers. 4. Reconcile every backlog task through the CLI using implementation and test evidence, retaining unfinished criteria and archiving superseded proposals. 5. Run typechecks, focused component tests, browser regressions and production build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
UI contract fixes verified by 90 Chromium browser tests, 19 dashboard unit tests and all workspace typechecks. Corrected a stale histogram seed that omitted the count/sum columns written by OTLP ingestion. Server regression suite and the explicit Python protobuf/gzip exporter test pass; production build succeeds.

Reviewed tasks 1–27 using the Backlog CLI. Updated obsolete descriptions/plans/references and acceptance criteria; reopened auth documentation, returned graceful shutdown to To Do, archived the superseded flat-tree proposal, marked the dated GenAI target complete, and retained remaining streaming/migration/auth requirements.

Browser screenshot: ![Measured metric values](assets/images/ui-metrics-2026-09-21.png)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed dashboard metric/API mismatches, zero-versus-missing values and active-tab refresh/keyboard behavior. Removed unsupported Timeline metric paths and unused helpers/state; cleaned up global subscriptions. Added real OTLP browser assertions and corrected the stale histogram seed.

Reviewed every existing backlog task against local code, corrected current descriptions/plans/references and criteria, reopened overstated completion, archived the superseded API redesign, and documented remaining requirements in doc-1.

Validation: 90 browser tests, 19 dashboard unit tests, full server suite, explicit real Python protobuf/gzip integration, workspace typechecks, production build and diff whitespace checks passed. Historical Docker results remain identified as historical.
<!-- SECTION:FINAL_SUMMARY:END -->
