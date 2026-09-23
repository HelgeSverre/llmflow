---
id: TASK-66
title: Make development startup and recipes robust to occupied ports
status: Done
assignee:
  - '@codex'
created_date: '2026-09-23 07:11'
updated_date: '2026-09-23 07:29'
labels: []
dependencies: []
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Development should start automatically when preferred server, proxy, or Vite ports are occupied. All development endpoints, WebSocket origins, demos, and status output must use actual running addresses. Review and exercise justfile recipes with isolated data and safe handling for destructive or deployment operations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Combined and split development commands automatically bind available ports and report actual endpoints
- [x] #2 API and WebSocket forwarding work after fallback, including backend restarts and occupied frontend ports
- [x] #3 Startup failure and Ctrl+C clean up owned listeners without stopping unrelated processes
- [x] #4 Demo and status recipes discover actual development endpoints
- [x] #5 Justfile recipes are reviewed and tested or explicitly report unavailable external prerequisites
- [x] #6 Collision regressions, relevant suites, typecheck, and formatting checks pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a shared development launcher that binds preferred ports directly and falls back atomically, publishes actual endpoints, and cleans up owned resources.
2. Route combined/split dev recipes through it; make Vite API/WebSocket routing, demos, and status discover current live endpoints.
3. Add collision, restart, stale-discovery, and shutdown tests with isolated databases; retain strict production port binding.
4. Review every just recipe, execute local recipes safely, validate external/destructive recipes without deployment or personal data deletion, and document unavailable prerequisites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User requested no headed E2E tests. The earlier headed process had already exited when checked; no further headed tests will run. Headless E2E passed all 125 tests. Restored only tracked screenshots generated during recipe validation.

Implemented one development launcher with direct bind/fallback, shared live endpoint discovery, dynamic Vite API/WebSocket targets, current-origin validation, graceful cleanup, and actual-port health reporting. Added Docker host-port retry and endpoint reporting. Reviewed recipes; repaired OG-image import/output path, made clean respect DB_PATH/DATA_DIR, made status use discovery, allowed Playwright UI arguments, and excluded CLI-managed backlog/generated protobuf from formatting.

Recipe validation: default, dev, dev-server, dev-dashboard, demo, demo-many, status, test, test-otlp, test-ws, test-logs, test-metrics, test-providers, typecheck, build and og-image passed. Six startup/recipe regression tests passed with 72 assertions, covering all occupied preferred ports, API/WebSocket forwarding, backend restart, stale records, SIGINT cleanup, invalid configuration, partial-startup cleanup, isolated clean, all-recipe dry runs, and simulated Docker collisions.

Headless Playwright: 125 passed. Playwright UI was smoke-tested through an ephemeral HTTP listener without opening its browser. No further headed testing after the user requested headless-only. Format recipe ran successfully in an isolated copy; changed-source formatting passes. Vercel production flags were validated using a successful --dry invocation; no deployment was published.

External/pre-existing limitations: real Docker startup/stop/logs cannot run because the Docker daemon socket is absent; Compose configurations validate and the retry behavior passes a CLI stub test. Live provider recipe: 7 passed, 2 Gemini calls failed with HTTP 402 depleted credits, 3 providers skipped. Repository-wide format-check still reports unrelated existing source/document formatting violations; these were not bulk-reformatted.

Additional website recipes appeared during work and were preserved. Website serving passed an occupied-port-4000 smoke test (automatically chose a free port and returned HTTP 200); website-og invokes the repaired generator, already tested. All current recipes pass dry-run parsing. Repository-wide format-check is now limited to five pre-existing files after protecting Backlog metadata and the generated protobuf schema. Final self-review, changed-file formatting and diff checks passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Development now binds preferred backend/proxy/frontend ports directly and falls back to OS-assigned ports on collisions. Combined and split launchers share actual endpoint discovery, update API/WebSocket routing after backend restarts, allow actual frontend origins, and clean up listeners and discovery records on signals or failed startup. Production startup remains strict about configured ports.

Updated dev/demo/status recipes and workspace scripts, added Docker host-port retry and published endpoint reporting, repaired OG image generation, made clean honor configured database paths, allowed Playwright UI arguments, and protected CLI-managed Backlog metadata/generated protobuf from formatting. Documented startup and endpoint behavior.

Validation: full server suite, all signal/provider-unit recipes, 125 headless Playwright tests, workspace/tooling typecheck, build, OG generation, six collision/recipe regressions, isolated format/clean, UI HTTP smoke, website port-collision smoke, Compose validation, and Vercel dry-run checks. No further headed tests after the user requested headless-only; all generated tracked screenshots were restored.

Limits: Docker daemon unavailable, so actual container startup remains unverified (retry logic covered by a CLI stub). Live provider tests had seven passes, two Gemini HTTP 402 depleted-credit failures and three skips. Repository-wide formatting still flags five unrelated existing files; changed files pass.
<!-- SECTION:FINAL_SUMMARY:END -->
