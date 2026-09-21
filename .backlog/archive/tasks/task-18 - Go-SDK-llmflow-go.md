---
id: TASK-18
title: Go SDK (llmflow-go)
status: To Do
assignee: []
created_date: '2026-05-27 02:24'
updated_date: '2026-09-21 09:53'
labels:
  - feature
  - sdk
dependencies: []
references:
  - packages/sdk/index.js
  - apps/server/src/server.ts
priority: low
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Go SDK remains future work. Use the existing JavaScript SDK and ingestion API as the behavioral reference; there is no implemented Python SDK to mirror yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 go-gettable module
- [ ] #2 Go tracing/span API preserves correlation and ingestion behavior of the existing JavaScript SDK.
- [ ] #3 Example under examples/go/
- [ ] #4 README links the Go SDK
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Keep it tiny — a single Client struct with LogSpan(ctx, span) and a default OTLP exporter. Use net/http only, no SDK frameworks. Tag releases independently from the npm package.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open; corrected the claim that both TypeScript and Python SDK implementations already exist.

2026-09-21 product-scope pruning: A separate Go SDK duplicates the standard OTLP path without a demonstrated integration gap. Revisit only with a concrete unsupported user workflow.
<!-- SECTION:NOTES:END -->
