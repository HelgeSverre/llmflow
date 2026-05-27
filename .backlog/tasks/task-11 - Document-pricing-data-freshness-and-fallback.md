---
id: TASK-11
title: Document pricing data freshness and fallback
status: Done
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-05-27 04:11'
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
- [x] #1 README has a Pricing section: source (LiteLLM), refresh policy, fallback file, refresh CLI/instructions
- [x] #2 /api/health/providers (or /api/health) surfaces pricing_source ('litellm' | 'fallback') and pricing_last_updated
- [x] #3 Dashboard shows a warning banner when pricing is on fallback for >7 days
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Track the timestamp of the LiteLLM fetch (or the fallback file's mtime) in memory at boot. Surface in /api/health. Banner is a small Svelte component in the dashboard header. README section explains why this matters and how to refresh manually.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@llmflow/pricing tracks source (litellm/fallback/unknown) and last-updated timestamp. /api/health returns these in a 'pricing' block alongside model_count and upstream_url. README has a 'Pricing data' section. Dashboard mounts PricingFreshnessBanner which warns when on fallback >7 days.
<!-- SECTION:FINAL_SUMMARY:END -->
