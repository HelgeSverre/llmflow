---
id: TASK-18
title: Go SDK (llmflow-go)
status: To Do
assignee: []
created_date: '2026-05-27 02:24'
labels:
  - feature
  - sdk
dependencies: []
references:
  - packages/sdk/
  - examples/
  - 'todos.md:143'
priority: low
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a Go SDK in the same shape as the TS and Python SDKs — direct POST /api/spans plus OTLP HTTP export convenience. Listed as Low priority in the existing Feature Requests table.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 go-gettable module
- [ ] #2 API mirrors the TS/Python surface
- [ ] #3 Example under examples/go/
- [ ] #4 README links the Go SDK
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Keep it tiny — a single Client struct with LogSpan(ctx, span) and a default OTLP exporter. Use net/http only, no SDK frameworks. Tag releases independently from the npm package.
<!-- SECTION:PLAN:END -->
