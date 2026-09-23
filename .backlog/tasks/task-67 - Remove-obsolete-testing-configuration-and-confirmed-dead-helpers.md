---
id: TASK-67
title: Remove obsolete testing configuration and confirmed dead helpers
status: Done
assignee:
  - '@codex'
created_date: '2026-09-23 07:37'
updated_date: '2026-09-23 07:39'
labels: []
dependencies: []
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove the obsolete Playwright configuration and related confirmed leftovers so startup and testing have one clear supported path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Only the supported Playwright configuration remains and current tests still discover and run
- [x] #2 Removed helpers or tooling have no remaining callers or supported entrypoints
- [x] #3 Relevant headless tests, typecheck, and changed-file formatting pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the unused CommonJS Playwright config and verify any referenced legacy setup.
2. Remove only additional helpers/tooling whose lack of callers is confirmed, preserving published APIs and current working-tree work.
3. Validate test discovery, headless E2E behavior, typecheck, formatting, and references.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed playwright.config.cjs, which was superseded by the TS config and referenced a missing global-setup module. Removed the unexported getMimeType helper after verifying it had no callers; static serving already uses Bun.file. Kept standalone OTLP test files because they contain useful assertions and documented manual entrypoints, so they are not confirmed dead code. Playwright discovery still finds 125 tests in 14 files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the obsolete CommonJS Playwright config, leaving playwright.config.ts as the sole configuration. The deleted config hardcoded port 3001 and referenced a global setup module that no longer exists. Removed the unused, unexported getMimeType server helper; Bun.file already supplies static response content types.

Verified that no active references remain. Playwright discovers all 125 tests in 14 files, the three UI contract tests pass headlessly, server typecheck passes, and changed-file formatting and diff checks pass. Preserved existing working-tree changes and standalone OTLP tests with useful coverage/manual entrypoints.
<!-- SECTION:FINAL_SUMMARY:END -->
