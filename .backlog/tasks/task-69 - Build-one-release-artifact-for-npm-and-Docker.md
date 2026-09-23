---
id: TASK-69
title: Build one release artifact for npm and Docker
status: Done
assignee:
  - '@codex'
created_date: '2026-09-23 08:00'
updated_date: '2026-09-23 08:32'
labels: []
dependencies: []
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generate dashboard and bundled server from source into a single release layout instead of relying on committed dashboard output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dashboard builds locally and root build assembles complete runtime assets in dist
- [x] #2 npm pack builds artifacts and installed CLI uses only shipped files
- [x] #3 Docker builds from source and runs the same bundled artifact
- [x] #4 Generated dashboard output is untracked and build/package checks pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Build dashboard to apps/dashboard/dist; assemble server and runtime assets in root dist using script-relative paths; select source versus bundled assets explicitly at build time; build on npm pack; use Docker build/runtime stages; remove tracked public output; verify tarball and headless dashboard.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented workspace-local dashboard output and assembled dist release; npm prepack builds, Docker uses multi-stage build, generated public output removed. Explicit CJS package metadata and documented ownership. Tarball smoke now checks offline pricing and excludes source assets.

Verified full server suite (one optional Python exporter skipped), typecheck, three headless UI contract tests against the bundle, npm pack/install smoke, build from /tmp, frozen install and Compose configuration. Docker daemon is unavailable, so actual image build/run remains unverified.

Consolidated third-party licensing into licenses/opentelemetry-proto.txt with source/version provenance; build copies licenses into ignored dist/licenses and tarball validation verifies inclusion. Removed the package-local PROTO-LICENSE file.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced committed dashboard output with one generated dist artifact containing server, dashboard and runtime assets. npm pack/publish builds automatically; Docker builds from source and copies the same layout. Fixed bundled/source pricing paths and installed start scripts, exercised the bundle in Playwright, and strengthened consumer packaging checks. Local tests pass; actual Docker image build/run could not be checked because the daemon is unavailable.
<!-- SECTION:FINAL_SUMMARY:END -->
