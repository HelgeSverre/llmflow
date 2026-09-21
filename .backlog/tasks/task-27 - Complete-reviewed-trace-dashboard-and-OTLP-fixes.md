---
id: TASK-27
title: Resolve all 29 GitHub review issues and local review findings
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 07:52'
updated_date: '2026-09-21 09:42'
labels: []
dependencies: []
references:
  - docs/github-issue-verification.md
  - apps/server/test/reviewed-fixes.test.ts
  - e2e/playwright/trace-waterfall.spec.js
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement fixes for GitHub issues #5 through #33 and the local review findings, remove stale assumptions and broken compatibility paths, and verify with isolated server, packaging, and browser tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Trace selection rejects obsolete requests including repeated same-ID selections and deselection.
- [x] #2 Nested API trees render all descendants and details with accurate timing; viewport prop updates preserve valid same-trace state and reset unrelated trace state.
- [x] #3 Waterfall geometry matches measured columns and panels stay usable without document overflow at desktop and narrow widths.
- [x] #4 OTLP current and legacy token attributes persist correct totals and fixture cost; system instructions do not suppress prompt messages.
- [x] #5 Native listeners default to loopback with explicit host overrides, documented container configuration, and listener-address integration coverage.
- [x] #6 Affected stale code and documentation are updated; targeted tests, typechecks, and browser visual verification pass.
- [x] #7 Proxy identities, metadata, header redaction, query forwarding, invalid JSON handling, streaming normalization, Anthropic accounting, Gemini detection, and timeouts satisfy issues #5, #8, #10, #11, #16, #17, #20, #21, and #26.
- [x] #8 WebSocket origin validation, independent telemetry subscriptions, complete exports, and JSON/protobuf/gzip OTLP decoding satisfy #7, #9, #12, and #13.
- [x] #9 Isolated test runners, signal failure handling, accurate model/session statistics, retention integrity, and timestamp handling satisfy #14, #15, #19, #22, #27, and #30.
- [x] #10 SDK defaults, missing-Bun diagnostics, and an installable clean npm artifact satisfy #25, #28, and #29; live filters and idempotent WebSockets satisfy #24 and #33.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Fix trace selection generations and use a typed adapter for the actual nested tree response.
2. Make viewport updates preserve valid same-trace state, reset unrelated traces, measure actual bar width, and repair panel sizing.
3. Resolve OTLP message extraction before attaching system instructions and verify token persistence with deterministic pricing.
4. Default listeners to loopback with host overrides; update container and affected documentation.
5. Run isolated unit/integration tests, typechecks, browser E2E and screenshot review; record results and remaining unrelated backlog accurately.

6. Extend the implementation to all open issues #5–#33 as explicitly confirmed: request/streaming contracts, OTLP wire formats and fanout, DB integrity/aggregation, test isolation, CLI/artifact packaging, and live dashboard synchronization. Verify each with regression tests and rerun browser checks after integration.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented all issue groups: incremental proxy streaming and cancellation, credential redaction/migration, OTLP protobuf/gzip, multi-subscriber full-record export, measured statistics, trace-aware retention/session ownership, SDK ports, isolated runner, packaged Bun server and Node launcher. New transport, proxy, database and dashboard lifecycle regressions pass; real Python exporter integration passes. Initial clean npm artifact failed resolving @llmflow/db; bundled artifact passes the clean-consumer startup gate. Final combined verification in progress.

Final verification passed: complete isolated server suite including real Python protobuf/gzip export, all workspace typechecks, 18 dashboard tests, 87 Playwright tests, production build and clean npm artifact/CLI gate. Inspected desktop and 390px screenshots in light/dark themes. Self-review removed obsolete provider parser APIs and retained Cohere billed usage and native Gemini JSON capture with dedicated regressions. Detailed issue evidence is in docs/github-issue-verification.md.

2026-09-21 reconciliation: Reviewed completion against the issue verification report. Earlier test counts are historical verification records, not current suite totals. Subsequent UI contract cleanup has its own browser assertions in e2e/playwright/ui-contracts.spec.js.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Resolved all 29 GitHub review issues (#5–#33) in the local working tree. The proxy now uses unique span identities, sanitized immutable logging context, incremental provider normalization and explicit cancellation/deadlines. OTLP ingestion handles bounded JSON/protobuf/gzip and timestamp fallbacks; independent subscribers export complete records while the dashboard receives summaries. Database migrations scrub historical credentials, repair timestamps and support whole-trace retention and accurate session/model aggregation.

The dashboard adapts nested trees, handles asynchronous selection and live-filter races, updates reactive viewports and contains scrolling at desktop/mobile sizes. Packaging now ships a self-contained Bun server with a Node launcher and a clean-consumer release gate; SDK defaults and isolated test processes are verified. Removed obsolete parsers and Express handlers, updated documentation and rebuilt dashboard assets.

Validation: all workspace typechecks, isolated server suite including actual Python OTLP exporter, 18 dashboard tests, 87 Playwright tests with screenshot inspection, production build, clean npm install/startup and missing-Bun CLI matrix, Prettier and diff checks. Provider behavior uses local upstream mocks; live credentialed probes remain opt-in. No commits, pushes or GitHub issue mutations were made.
<!-- SECTION:FINAL_SUMMARY:END -->
