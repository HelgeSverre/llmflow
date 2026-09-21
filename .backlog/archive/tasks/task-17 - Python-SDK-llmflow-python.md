---
id: TASK-17
title: Python SDK (llmflow-python)
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
  - packages/sdk/index.d.ts
  - apps/server/test/python-otlp.py
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A distributable Python SDK remains future work. The repository contains a JavaScript SDK with TypeScript declarations and a Python OpenTelemetry exporter interoperability test; that exporter test is not an llmflow Python SDK.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pip-installable package (llmflow-py or similar) on PyPI
- [ ] #2 Python tracing/span API preserves correlation and ingestion behavior of the JavaScript SDK, with documented Python idioms.
- [ ] #3 Sync + async variants (httpx)
- [ ] #4 Example under examples/python/
- [ ] #5 README links the Python SDK alongside the JavaScript SDK with TypeScript declarations.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Design Python tracing and span correlation against the existing JavaScript SDK and ingestion API. Implement sync/async httpx transport, package metadata, focused tests and examples; verify an installed package before documenting release availability.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open. Corrected the implemented SDK language and distinguished an interoperability test from a Python SDK.

2026-09-21 product-scope pruning: A second maintained SDK is speculative when Python OpenTelemetry exporter interoperability already works and is tested. Revisit only for a concrete workflow the standard exporter cannot support.
<!-- SECTION:NOTES:END -->
