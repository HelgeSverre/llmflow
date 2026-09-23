---
id: TASK-97
title: Harden the Docker image and build it in CI
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - docker
  - ci
milestone: m-0
dependencies:
  - TASK-71
  - TASK-73
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
- [ ] #1 `docker build` succeeds in CI for linux/amd64 and linux/arm64 and the container answers /api/health on the documented ports
- [ ] #2 Image pins the Bun tag, runs as non-root, carries OCI labels with the version, and rebuilds without reinstalling when only source changes
- [ ] #3 DOCKER_HUB.md matches the image (ports, hosts, providers, domain, volume path)
<!-- AC:END -->
