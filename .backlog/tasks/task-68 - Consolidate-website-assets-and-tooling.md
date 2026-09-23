---
id: TASK-68
title: Consolidate website assets and tooling
status: Done
assignee:
  - '@codex'
created_date: '2026-09-23 07:58'
updated_date: '2026-09-23 08:00'
labels: []
dependencies: []
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the marketing site ownership of its assets and generation commands before restructuring application builds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Website assets and generation tooling live under website with references updated
- [x] #2 Existing website commands work from root and website without backend source paths
- [x] #3 Validate asset links and headless image generation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Move marketing generation scripts and templates into website; consolidate screenshot assets with references preserved; make website commands local; verify generation headlessly and asset references. Then document package ownership and build cleanup sequence.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consolidated marketing screenshots and OG generation under website, removed byte-identical screenshot duplicates, and added a private website workspace with local scripts. Root recipes forward to website commands. Verified local asset links, recipe contracts, and headless OG generation to a temporary output.
<!-- SECTION:FINAL_SUMMARY:END -->
