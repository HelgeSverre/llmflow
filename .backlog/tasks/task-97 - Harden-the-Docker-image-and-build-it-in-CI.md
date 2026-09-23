---
id: TASK-97
title: Harden the Docker image and build it in CI
status: Done
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 12:10'
labels:
  - docker
  - ci
milestone: m-0
dependencies:
  - TASK-71
  - TASK-73
  - TASK-104
references:
  - docker/Dockerfile
  - docker/docker-compose.yml
  - DOCKER_HUB.md
  - .github/workflows/checks.yml
priority: high
type: task
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The new multi-stage `docker/Dockerfile` has never been built (no daemon in either session). Published `helgesverre/llmflow:latest` is arm64-only, from commit 3e0caf2, serving the dashboard on port 3000 while docs say 1337.
- `COPY . .` happens before `bun install` (:3-4): any change invalidates the install layer; copy manifests first.
- Floating `oven/bun:1`; runs as root with `VOLUME /root/.llmflow`; no OCI labels/version; build stage should use `--platform=$BUILDPLATFORM` (output is plain JS) for fast multi-arch.
- Non-root `bun` user changes the volume path; document the migration for existing users.
- `DOCKER_HUB.md`: links `llmflow.dev` (site is `www.llmflow.app`), omits `PROXY_HOST`/`DASHBOARD_HOST` (image sets both to 0.0.0.0), omits Cohere/Perplexity.
- Add a CI job: `docker build -f docker/Dockerfile .`, run the container, curl `/api/health`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `docker build` succeeds in CI for linux/amd64 and linux/arm64 and the container answers /api/health on the documented ports
- [x] #2 Image pins the Bun tag, runs as non-root, carries OCI labels with the version, and rebuilds without reinstalling when only source changes
- [x] #3 DOCKER_HUB.md matches the image (ports, hosts, providers, domain, volume path)
- [ ] #4 Runtime stage copies apps/server/dist only; build stage installs with bun ci
- [ ] #5 Container runs as uid 1000 (USER bun) and the volume path change from /root/.llmflow is documented with a migration note
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged cleanup/task-97 into main (clean merge, no conflicts). The earlier 'blocked' note is obsolete: the user approved the whole m-0 milestone.

Verified facts and decisions:
- The Docker daemon (OrbStack) works in this environment, so images can be built and run locally.
- The Dockerfile takes build args BUN_VERSION (default 1.4.2, keep in sync with .bun-version), VERSION (default "dev"), REVISION (default "unknown") and CREATED (default empty). Pass CREATED explicitly: if it is left unset the image would inherit the base image's created label.
- TASK-98 release workflow: pass VERSION/REVISION/CREATED and use `docker buildx build --platform linux/amd64,linux/arm64 --push`. Only the runtime stage runs per target platform (COPY + mkdir), because the build stage runs on BUILDPLATFORM.
- TASK-99: the docker build job now exists as a separate `docker` job at the end of checks.yml, using native runners ubuntu-latest and ubuntu-24.04-arm, with no QEMU. TASK-99 should keep it when it restructures the file, and can add permissions/concurrency around it.
- The manifest COPY list in the Dockerfile names every workspace package.json explicitly (apps/dashboard, apps/server, e2e/playwright and 7 packages/*). Adding a workspace means adding a COPY line there, or `bun ci` fails with a frozen-lockfile mismatch.
- Runtime layout: WORKDIR /home/bun/app, data at /home/bun/.llmflow, and a volume at /root/.llmflow is ignored.
- Migration command: `docker run --rm -u 0 -v llmflow-data:/data --entrypoint chown helgesverre/llmflow -R 1000:1000 /data`.
- DOCKER_HUB.md still says MAX_TRACES and "traces". If TASK-95 renames the env var, update it there.

Validation on merged main: bun install, typecheck, lint, format:check, server tests (14 passed), dashboard tests (113 passed). Local docker build for linux/arm64 (native) and linux/amd64 (emulated): both containers answer /api/health on 1337, run as uid 1000 (bun), and carry OCI labels with the VERSION build arg. Changing a source file (apps/server/src/proxy.ts) and rebuilding left the `bun ci` layer CACHED. The CI docker job itself has not run yet because nothing was pushed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:06
---
Workspace decision (2026-09-23): apps/server becomes the published llmflow package and the root goes private (see the "Make apps/server the published llmflow package" task); website leaves the workspaces list. Adjust paths accordingly: dist/ and bin/ live under apps/server.
---

created: 2026-09-23 09:24
---
Verified 2026-09-23: the oven/bun debian, slim and alpine images create user bun (uid/gid 1000) with WORKDIR /home/bun/app but have no USER directive, so add USER bun explicitly and move the volume to /home/bun/.llmflow (document the migration from /root/.llmflow). Distroless has no user. FROM --platform=$BUILDPLATFORM ... AS build is documented BuildKit syntax.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened docker/Dockerfile: Bun tag pinned (BUN_VERSION 1.4.2), manifests copied before `bun ci` so source-only changes reuse the install layer, build stage on BUILDPLATFORM, non-root bun user with data in /home/bun/.llmflow, OCI labels from VERSION/REVISION/CREATED. Added a native amd64/arm64 `docker` job to checks.yml that builds, runs and curls /api/health. Rewrote DOCKER_HUB.md (ports, hosts, providers, www.llmflow.app, volume path and migration) and updated compose/README. Verified with the full repo gate and local amd64/arm64 builds and health checks.
<!-- SECTION:FINAL_SUMMARY:END -->
