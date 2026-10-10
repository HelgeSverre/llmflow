---
id: TASK-112
title: Audit GitHub issue completion and AtFlows backport candidates
status: Done
assignee:
  - '@codex'
created_date: '2026-10-10 20:05'
updated_date: '2026-10-10 20:10'
labels: []
dependencies: []
references:
  - 'https://github.com/aetna000/atflows'
  - CONTEXT.md
  - TASK-27
type: spike
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review all open GitHub issues against local main, close completed issues with fresh verification evidence, inventory pending local work and worktrees, and inspect aetna000/atflows for backport candidates that fit LLMFlow's local debugging scope. User limited implementation to GitHub issues; local vocabulary tasks and new fork features are assessed, not implemented in this pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All open GitHub issues have an evidence-based disposition; completed issues are closed as authorized.
- [x] #2 Pending local tasks, drafts, task files, and Git worktrees are inventoried.
- [x] #3 AtFlows recommendations cite pinned source and distinguish existing fixes, useful backports, and coupled features.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory GitHub issues, Backlog tasks/drafts, local task files and Git worktrees.
2. Match issues #5–#33 to current fixes and run check, unit/integration, browser and clean-package gates; run real Python OTLP integration separately.
3. Close verified issues with specific evidence and make local unpushed status explicit.
4. Inspect pinned AtFlows source for capture, investigation and integration additions; compare with current code and existing backlog, then rank useful backports and coupling costs.
5. Record verified findings and remaining work in Backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 audit of local main 3d19dfac800b161a914d43e167227ed222dc3b7a and AtFlows 124b1c27d51a3d732a7df15f099c783f73903044.

Research objective: identify fork additions that improve accurate capture, investigation and setup without importing AtMem accounts, roles, branding or its execution-control product. Questions: which capabilities are absent here; which are small independent additions; which require new ingest/schema/instrumentation; and what evidence or scope limits prevent direct reuse?

GitHub: reviewed all 29 open issues (#5–#33). Every original bug already had a local fix from TASK-27 and subsequent cleanup; no new production-code change was necessary. Fresh gates passed: bun run check (all workspace/root types, oxlint, oxfmt), bun run test (229 server/package tests, 116 dashboard tests; one optional Python test skipped in that run), 125 Playwright tests, and bun run test:package (both clean consumer tarballs, CLI missing-Bun/help/version, dashboard/API startup and SDK delivery/types). Created a temporary Python venv outside the repo and ran the skipped real Python gzip/protobuf exporter test successfully (1 pass). Current code was pushed to main (508deb2 -> 3d19dfa) under explicit user authorization. Closed issues #5–#33 as completed with issue-specific regression evidence and a link to published main; a fresh gh issue list --state open returned [].

Local inventory before this audit task: TASK-106 through TASK-111 are To Do (Traces as groups; closed span-type set; session/service/agent distinctions; count/token/cost measures; Usage view; glossary wording). TASK-110 depends on TASK-109. TASK-98 remains In Progress: release tooling exists; hosted release rehearsal and an actual artifact-aligned release remain. No Backlog drafts, stray task/TODO/plan/RFC files, or unchecked Markdown TODOs outside Backlog were found. Thirteen archived tasks are historical deferred scope, not current work. git worktree list shows only the primary checkout at /Users/helge/code/llmflow on main; .git/worktrees and .codex/worktrees are absent, .claude/worktrees is empty, app attachments are empty. Only local branch is main; only remote branch is origin/main, so no branch/worktree deletion is needed. Pre-existing packages/pricing/pricing.fallback.json edit is preserved and excluded from audit commits.

Fork evidence is source-level, pinned to 124b1c27d51a3d732a7df15f099c783f73903044; no fork runtime/scripts were executed. Implementation presence has high confidence; compatibility/benefit estimates are engineering judgments, not benchmarked claims. AtFlows acknowledges it is a continuation of LLMFlow although GitHub reports isFork=false. It still uses an older JS/root-package layout, single insert hooks, direct process.env reads and inline schema changes, so cherry-picking whole files would undo established fixes.

Backport recommendations, in priority order:
1. JSON downloads of a selected trace/span, related logs and current filtered view. LLMFlow has OTLP export and REST access, but no browser download action. The fork uses a small Blob helper and buttons across investigation views. Useful for sharing a reproducible local bug without copying SQL. Adapt to current snake_case DTOs and LLMFlow branding; include filter/scope metadata and clearly distinguish loaded rows from complete history. A selected trace should download full sanitized tree/detail records, not a lossy summary. Remove all account/role dependencies. Source: https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/utils/export.ts and https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/components/traces/TracesTab.svelte.
2. Grouped Timeline overview with clickable bars for service/model/span type/hour and optional session. Current LLMFlow has timeline filters and aggregate Analytics, but no interactive grouping of the loaded Timeline. The fork transparently limits counts to the latest 100 matching events; retain that scope labeling and keyboard-operable buttons. Current TimelineItem lacks some grouping identities, so add supported fields deliberately or start with service/type/hour; use the glossary's span/log vocabulary. No new all-history claims or storage subsystem are needed. Sources: https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/components/timeline/EventGroups.svelte, https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/utils/event-groups.ts and https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/docs/event-overview.md.
3. A Connect view that generates snippets from actual dashboard/proxy URLs and explains what each integration captures, prerequisites and validation status. Current README/examples and dev discovery already exist; the improvement is setup inside the running app with accurate endpoints. Start with read-only copyable guides. Automatic config edits are a separate higher-risk slice: the fork's Codex helper uses preview/apply/undo, expiry, hashes and private backups; do not import it wholesale or overwrite existing telemetry settings. Exclude AtMem/AtBots marketing and all account coupling. Sources: https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/packages/integrations/src/index.ts, https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/components/connect/ConnectTab.svelte, https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/packages/integrations/src/codex.ts and https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/packages/integrations/src/local-config.ts.
4. Dependency-free JSON syntax highlighting and a compact read-only server/storage status view. These are smaller polish/debugging improvements after the three above. JsonCode renders token text through Svelte escaping rather than HTML injection; database settings merely expose active SQLite location and its config source. Sources: https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/components/shared/JsonCode.svelte, https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/utils/json-highlight.ts and https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/apps/dashboard/src/lib/components/settings/DatabaseTab.svelte.
5. Retry/attempt investigation is potentially useful later, but adapt it to standard span attributes rather than importing the AtMem contract. Fork continuity uses a new allowlisted endpoint, continuity_events table, producer token, workflow/run/attempt/charge identities and unknown-price accounting; it is not a UI-only backport. Preserve the principle that missing prices are unknown and retries/recovery must not double-count charges. Defer until a concrete workload requires it. Sources: https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/packages/db/src/continuity.ts and https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/docs/integrations/continuity.md.
6. Hermes/OpenClaw integration recipes can be revisited when a user needs those producers. Native Hermes currently requires a narrowly qualified Hermes version and separate metadata-only schema/plugin lifecycle. That is more maintenance than a generic OTLP guide; it also lacks full prompt/tool evidence and known costs. Source: https://github.com/aetna000/atflows/blob/124b1c27d51a3d732a7df15f099c783f73903044/docs/integrations/hermes.md.
7. Database batching/composite indexes/cache changes in fork commit 124b1c27d51a3d732a7df15f099c783f73903044 are leads for a future measured performance investigation. Do not copy 30-second metric cache staleness or process-local counters into the current query/retention design without workload evidence and multi-process correctness checks. Source: https://github.com/aetna000/atflows/commit/124b1c27d51a3d732a7df15f099c783f73903044.

Explicit user decision: AtMem account system and branding must not be ported. No feature backports or speculative follow-up tasks were created in this audit. Fork-auth/rebrand code is excluded. If later copying fork-authored code, retain its Apache-2.0 attribution/license notices alongside inherited MIT notices. Recommendations require fitting current packages, route tables, SETTINGS, versioned migrations, glossary, oxlint/oxfmt and test gates.

Hosted verification also passed for pushed main 3d19dfa: https://github.com/HelgeSverre/llmflow/actions/runs/38082443646. The verify job ran check, the suite with real Python exporter, production build, both package gates and Playwright; Docker build/container-health jobs passed on linux/amd64 and linux/arm64.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All 29 GitHub issues were already fixed in current code; re-verified the full local check/test/browser/package gates plus a real Python exporter, pushed main, and closed #5–#33 with evidence. Inventoried seven pre-existing pending Backlog tasks, no drafts/stray task files, and one primary worktree with no extra branches to clean. Reviewed pinned AtFlows 124b1c2 and ranked JSON downloads, grouped Timeline inspection and endpoint-aware connection guides as the strongest backport candidates; excluded AtMem accounts and branding per user instruction. Production code and the pre-existing pricing edit are unchanged. Full source-linked findings are in implementation notes.
<!-- SECTION:FINAL_SUMMARY:END -->
