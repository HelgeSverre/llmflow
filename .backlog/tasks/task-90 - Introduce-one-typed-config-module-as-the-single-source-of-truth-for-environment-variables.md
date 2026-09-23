---
id: TASK-90
title: >-
  Introduce one typed config module as the single source of truth for
  environment variables
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 18:49'
labels:
  - refactor
  - config
milestone: m-0
dependencies:
  - TASK-85
  - TASK-89
references:
  - apps/server/src/server.ts
  - bin/llmflow.js
  - .env.example
  - README.md
priority: medium
type: task
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is no config module: `process.env` is read ad hoc in server, db, otlp/export, pricing, logger, providers (azure, ollama, passthrough), sdk, dev scripts and `vite.config.ts`. Four partial env-var lists exist (README table 147-155, `bin/llmflow.js:17-26`, `.env.example`, `DOCKER_HUB.md:34-40`) and none is complete. Same variable parsed with different defaults/validation (DASHBOARD_PORT validated in server/dev-runtime, `||` in vite.config; VERBOSE in pricing and logger).
Build `packages/shared/src/config.ts` (or `apps/server/src/config.ts`) that parses and validates every variable once with defaults, and export the list with descriptions so `--help`, README and `.env.example` are generated from it (script `scripts/gen-env-docs.ts` or a test that asserts they match).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All server-side process.env reads go through the config module (grep proves it outside the module, SDK and Vite config)
- [x] #2 `llmflow --help`, README config table and .env.example are generated from / asserted against the same list and are identical in content
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. packages/shared/src/config.ts: SETTINGS list + typed getters (read on access, undeclared names throw). 2. Route every server/package/dev-script/build env read through it. 3. Renderers (config-docs.ts) + bun run env:docs generate .env.example, README block and llmflow --help. 4. Tests: config getters; no process.env readers outside config; generated docs match. 5. Gate, test:package, Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- @llmflow/shared/config: SETTINGS (47 entries in 6 groups: Servers, Storage, Provider API keys, Provider settings, OTLP export, Development) and 'config' with typed getters (ports validated 0-65535; ints fall back to the default on junk/0; DATA_DIR/DB_PATH expand ~; otlpExport returns the whole export block). readSetting(name) throws for undeclared names; empty strings count as unset (so DASHBOARD_PORT='' now means the default, not port 0). Values are read on access, not snapshotted, because tests and dev scripts set env before importing specific modules; modules that capture values at import (db, export, pricing) behave as before.
- Readers moved: db (DATA_DIR/DB_PATH/MAX_*), pricing (PRICING_URL), logger (VERBOSE/--verbose), server (hosts/ports), websocket-origin (WS_ALLOWED_ORIGINS), proxy (PROXY_TIMEOUT_MS), otlp export (all OTLP_EXPORT_*, LLMFLOW_OTLP_LEGACY_ATTRS), providers credentials/azure/ollama/helicone (packages/providers now depends on @llmflow/shared), dev-runtime (LLMFLOW_DEV_STATE_DIR, LLMFLOW_URL), dashboard dev.ts (VITE_PORT/VITE_HOST, DASHBOARD_PORT), server scripts dev/demo/build (LLMFLOW_REUSE_BUILD, newly documented).
- parsePort left @llmflow/shared/net (config owns env parsing); its tests moved to config.test.ts.
- Docs: packages/shared/src/config-docs.ts renders .env.example (byte-exact), the README block between <!-- env:start/end --> and the launcher's ENVIRONMENT_HELP constant between // env-help:start/end. 'bun run env:docs' = scripts/gen-env-docs.ts + oxfmt; it is idempotent. apps/server/test/env-example.test.ts asserts: no process.env reader outside config (exempt: packages/sdk, apps/dashboard/vite.config.ts, apps/server/test/, e2e/), .env.example == render, README table cells == render, 'node bin/llmflow.js --help' contains the rendered help. AGENTS.md convention updated.
- README: Configuration section is the generated table; the OTLP forwarding section points to it instead of repeating the variables.
- Not covered (docs task TASK-102): DOCKER_HUB.md still has its own short table with container defaults; it should link to .env.example or reuse the render.
Validation: bun run check green; bun run test 233 pass/1 skip + dashboard 116; test:package passed (launcher --help works without Bun); Playwright 125 passed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Placement: the config module must live in packages/shared (packages/providers, otlp and db cannot import apps/server). The SDK is a standalone published package and keeps reading its own two variables.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added packages/shared/src/config.ts as the single, typed, validated source for every environment variable and moved all server, package and tooling reads onto it; .env.example, the README configuration table and llmflow --help are now generated from the same list by bun run env:docs, with tests enforcing both the single reader and the generated docs. Verified with bun run check/test, test:package and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
