---
id: TASK-11
title: Document pricing data freshness and fallback
status: To Do
assignee: []
created_date: '2026-05-27 02:22'
labels:
  - docs
  - p2
dependencies: []
references:
  - packages/pricing/src/index.js
  - packages/pricing/src/pricing.fallback.json
  - README.md
  - 'todos.md:115'
modified_files:
  - README.md
  - packages/pricing/src/index.js
  - apps/server/src/server.ts
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
README doesn't explain how @llmflow/pricing refreshes from LiteLLM, what the fallback path is, or how stale pricing affects the headline 'see what your LLM calls cost' promise. The product's flagship signal silently degrades if LiteLLM is unreachable on boot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README has a Pricing section: source (LiteLLM), refresh policy, fallback file, refresh CLI/instructions
- [ ] #2 /api/health/providers (or /api/health) surfaces pricing_source ('litellm' | 'fallback') and pricing_last_updated
- [ ] #3 Dashboard shows a warning banner when pricing is on fallback for >7 days
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Track the timestamp of the LiteLLM fetch (or the fallback file's mtime) in memory at boot. Surface in /api/health. Banner is a small Svelte component in the dashboard header. README section explains why this matters and how to refresh manually.
<!-- SECTION:PLAN:END -->
