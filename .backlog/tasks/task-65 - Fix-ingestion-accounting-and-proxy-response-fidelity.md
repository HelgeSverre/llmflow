---
id: TASK-65
title: Fix ingestion accounting and proxy response fidelity
status: Done
assignee:
  - '@codex'
created_date: '2026-09-22 13:34'
updated_date: '2026-09-22 13:41'
labels: []
dependencies: []
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the four reproduced review findings: cumulative counters overcount totals, structured OTLP attributes lose data, SSE event names are stripped, and normalized proxy responses lose upstream headers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cumulative sum totals account for temporality, separate series, resets, and out-of-order samples without summing cumulative snapshots
- [x] #2 Nested OTLP AnyValue attributes survive trace, log, and metric ingestion
- [x] #3 OpenAI streams preserve SSE event fields while still capturing usage
- [x] #4 Normalized proxy responses preserve applicable upstream headers including Retry-After
- [x] #5 Regression tests and relevant checks pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve metric temporality, timestamps, and series identity; derive cumulative increments when aggregating so resets, duplicate samples, and out-of-order arrivals are handled.
2. Share recursive OTLP AnyValue decoding across signals.
3. Preserve OpenAI SSE frames and applicable upstream response headers.
4. Add regression tests, run the server suite and typecheck, and review the diff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented raw cumulative sample metadata and summary increments, recursive AnyValue decoding, byte-preserving OpenAI streaming, and upstream response header forwarding. Focused ingestion/database regressions and server typecheck pass; proxy timing tests are finishing.

Original four repros now produce correct results: cumulative 100 -> 150 totals 150; nested attributes survive; named SSE frames are byte-identical; HTTP 429 preserves Retry-After. Fixed a histogram count regression caught by the full suite. Migration preserves legacy rows; historical temporality cannot be reconstructed.

Validation complete: full bun run test suite passes (optional Python exporter test skipped); server TypeScript check, changed-file Prettier check, git diff --check, and original isolated repros pass. Self-review complete.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed four ingestion and proxy correctness bugs. Cumulative counters retain temporality, series identity, and nanosecond timestamps; summary queries derive increments while handling resets, duplicate samples, late arrivals, and date windows. A schema migration preserves existing data, and metric export preserves the new metadata.

Shared recursive OTLP attribute decoding preserves nested objects, arrays, bytes, and empty containers across traces, logs, and metrics. OpenAI streams forward original SSE bytes while capturing usage, and normalized responses preserve upstream retry/request headers while removing inapplicable headers.

Validation: full bun run test suite passed with the optional Python exporter test skipped; server typecheck, Prettier checks, diff checks, and all four original repros passed. Regression coverage includes JSON/protobuf ingestion, migration compatibility, cumulative counter edge cases, named SSE events, and response headers.

Historical metric samples retain their original totals because their discarded temporality cannot be reconstructed.
<!-- SECTION:FINAL_SUMMARY:END -->
