---
id: TASK-50
title: Refresh live provider test models and make them configurable
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 13:16'
updated_date: '2026-09-21 13:35'
labels: []
dependencies: []
references:
  - apps/server/test/lib/live-providers.js
priority: medium
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Optional live provider tests used retired or inaccessible models and hardcoded model choices. Refresh defaults, support per-provider overrides and document missing credentials versus upstream account failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Live tests default to supported models and allow per-provider model overrides
- [x] #2 Unavailable credentials or billing are distinguished from application regressions without hiding failures
- [x] #3 Available live provider calls and deterministic fixture checks validate the updated suites
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Centralize live-test model defaults with environment overrides; update stale fixtures and document account prerequisites; rerun supported live integrations and keep account errors explicit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared configurable defaults added to both live suites. Seven provider checks and six passthrough checks passed; an explicit OpenAI model override also passed. Gemini current-model requests return account HTTP 402 (prepayment depleted); Together and Azure credentials are absent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced stale live-test model choices with shared configurable defaults. Both suites honor provider selection and per-provider model overrides; Azure requires an explicit deployment. README documents credentials, models and account error handling.

Validation: seven provider checks, six passthrough checks and an explicit OpenAI model override passed. Full deterministic server coverage passed. Gemini returns HTTP 402 for depleted prepayment credit; this remains an explicit external limitation, not a pass. Together and Azure were not live-verified without credentials.
<!-- SECTION:FINAL_SUMMARY:END -->
