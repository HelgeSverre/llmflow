---
id: TASK-90
title: >-
  Introduce one typed config module as the single source of truth for
  environment variables
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 09:15'
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
- [ ] #1 All server-side process.env reads go through the config module (grep proves it outside the module, SDK and Vite config)
- [ ] #2 `llmflow --help`, README config table and .env.example are generated from / asserted against the same list and are identical in content
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Placement: the config module must live in packages/shared (packages/providers, otlp and db cannot import apps/server). The SDK is a standalone published package and keeps reading its own two variables.
---
<!-- COMMENTS:END -->
