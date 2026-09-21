---
id: TASK-11
title: Document pricing data freshness and fallback
status: Done
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-09-21 09:42'
labels:
  - docs
  - p2
dependencies: []
references:
  - packages/pricing/src/index.js
  - packages/pricing/pricing.fallback.json
  - README.md
  - scripts/build-server.ts
modified_files:
  - README.md
  - packages/pricing/src/index.js
  - apps/server/src/server.ts
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pricing freshness is documented and exposed through /api/health. The dashboard warns when the bundled fallback is older than seven days. The bundled pricing file lives at packages/pricing/pricing.fallback.json and is copied into the distribution during build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README documents LiteLLM source, refresh policy, bundled fallback and manual refresh instructions.
- [x] #2 /api/health returns pricing.source and pricing.last_updated metadata.
- [x] #3 The dashboard warns when fallback pricing is older than seven days.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Track the timestamp of the LiteLLM fetch (or the fallback file's mtime) in memory at boot. Surface in /api/health. Banner is a small Svelte component in the dashboard header. README section explains why this matters and how to refresh manually.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Corrected the fallback file location and health field names to the actual API contract.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@llmflow/pricing tracks source (litellm/fallback/unknown) and last-updated timestamp. /api/health returns these in a 'pricing' block alongside model_count and upstream_url. README has a 'Pricing data' section. Dashboard mounts PricingFreshnessBanner which warns when on fallback >7 days.
<!-- SECTION:FINAL_SUMMARY:END -->
