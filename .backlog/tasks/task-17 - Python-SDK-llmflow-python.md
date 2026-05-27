---
id: TASK-17
title: Python SDK (llmflow-python)
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
  - 'todos.md:142'
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a Python SDK mirroring packages/sdk (TS). Direct POST /api/spans for synthetic spans, plus convenience helpers for OTLP HTTP export. Listed as High priority in the existing Feature Requests table.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pip-installable package (llmflow-py or similar) on PyPI
- [ ] #2 Minimal API: init(base_url, api_key?), log_span(name, attributes, ...) matching the TS SDK shape
- [ ] #3 Sync + async variants (httpx)
- [ ] #4 Example under examples/python/
- [ ] #5 README links to the Python SDK alongside the TS one
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use httpx for async, urllib3 fallback. Mirror the TS SDK surface 1:1 so docs can be reused. Publish via GitHub Actions on tag. Ship a typed stub package alongside if possible.
<!-- SECTION:PLAN:END -->
