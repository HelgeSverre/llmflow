# LLMFlow Issues Tracker

## Resolved in v0.3.2

All critical and medium issues from the v0.3.1 testing have been fixed.

### ✅ Fixed: Anthropic Passthrough Mode

**Was:** `/passthrough/anthropic` returned `{"error":"Invalid JSON response","body":""}` instead of the actual API response.

**Fix:** Passthrough now forwards raw bytes immediately to the client while buffering separately for logging. JSON parsing failures no longer affect the client response.

**Commit:** `009f730`

---

### ✅ Fixed: Streaming Responses Show 0 Token Count

**Was:** Dashboard showed 0 tokens for all streaming requests because SSE events were parsed per TCP chunk (which often splits JSON payloads).

**Fix:** Both proxy and passthrough streaming handlers now buffer the complete SSE stream and parse it once at the end for accurate token extraction.

**Commit:** `009f730`

---

### ✅ Fixed: Dashboard API Filtering by Provider

**Was:** Query parameter `?provider=anthropic` was ignored - `/api/traces` returned all traces.

**Fix:**

- Added `provider` and `tag` filter support to `db.getTraces()`
- Added query param extraction in `/api/traces` and `/api/traces/export`

**Commit:** `009f730`

---

### ℹ️ Clarified: Anthropic Proxy Mode Format Conversion

**Issue:** `/anthropic/v1/*` converts responses to OpenAI format.

**Status:** This is **by design**. Proxy routes normalize all responses for consistency.

**Solution:** Use `/passthrough/anthropic/v1/messages` for native Anthropic format.

---

## Open Issues

Findings from a deep inspection of `src/server.ts`, `src/db.ts`, `providers/`,
`otlp.js`, and the docs surface. Priority is engineering risk × user impact, not
ticket size.

### P0 — correctness / robustness, ship before any structural work

- [ ] **Wrap every `JSON.parse` on stored rows in a `safeJson` helper.**
      Sites: `src/server.ts:511-517` (`/api/traces/:id`), `src/server.ts:537-544`
      (`/api/traces/:id/tree`), `src/db.ts:666-667`, `src/db.ts:803-806`. One
      malformed `request_body` from a passthrough that wasn't JSON crashes the whole
      endpoint with a 500. Mechanical fix, ~5-line helper + replace.
- [ ] **Enable SQLite WAL mode and busy_timeout at boot.** Add
      `db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')` immediately
      after `new Database(...)` in `src/db.ts:16`. Concurrent OTLP ingest +
      WebSocket fanout + dashboard polling will eventually `SQLITE_BUSY` without
      this.
- [ ] **Guard top-level `Bun.serve(...)` with `if (import.meta.main)`.**
      `src/server.ts` starts both listeners at import time, so any test or tool
      that imports `dashboardServer`/`proxyServer` for typing or wiring boots real
      ports. Wrap the two `Bun.serve` calls in a `main()` function and call it
      conditionally.
- [ ] **Drop the misleading `provider TEXT DEFAULT 'openai'` on `traces`.**
      Make the column NULLABLE, set OTLP-ingested rows to the resolved provider
      (`otlp.js:246` already extracts `gen_ai.system` correctly), and render NULL
      as `unknown` in the UI. Right now Anthropic spans ingested via OTel get
      silently tagged as OpenAI when the upstream instrumentation forgot to set
      `gen_ai.system`.

### P1 — performance and correctness at >10k traces

- [ ] **Stream-parse SSE bodies instead of buffering the entire response into a
      growing string.** `src/server.ts:1023` (`processStreamForLogging`) appends
      every decoded chunk to `streamBuffer` until `done`. A 1M-token Claude
      generation holds multi-MB of UTF-16 in memory per concurrent stream. Parse
      per-line, accumulate the final usage, discard chunks.
- [ ] **Tag filter is substring-LIKE on serialized JSON** (`src/db.ts:489`).
      `tag=foo` matches `foobar`, `foo-bar`, etc. Either: (a) a `trace_tags`
      join table, or (b) `json_each(tags) WHERE value = $tag`.
- [ ] **`request_body LIKE %q%` does a full table scan on every search.** Add
      an FTS5 virtual table over `request_body`/`response_body`/`input`/`output`
      and rewrite the `q` filter to use `MATCH`. bun:sqlite ships FTS5.
- [ ] **Pruning runs on every insert.** `getTraceCount()` + `DELETE ... WHERE
    id NOT IN (SELECT ... LIMIT)` is O(N) per write. Either prune every Nth
      insert, or switch to a timestamp cursor (`DELETE FROM traces WHERE timestamp
< ?`) and only when count drifts past a threshold.
- [ ] **Per-trace body cap.** A 5 MB response body lands verbatim in
      `response_body`. Truncate with a marker at a configurable cap (mirror Glue's
      `max_body_bytes`, default 64 KB for headers + 512 KB for bodies). Logged
      _before_ `db.insertTrace`, not after.
- [ ] **Auth + listening-surface hardening.** Optional `LLMFLOW_TOKEN` bearer
      enforced on `/api/*`, `/v1/*`, and the WebSocket upgrade. `Dockerfile` and
      `docker-compose.yml` currently bind to `0.0.0.0` with no auth — one
      copy-pasted `-p` and the LAN can spam `/v1/traces` until SQLite fills.

### P2 — maintainability, do once the P0s are committed

- [ ] **Port `providers/*.js` to TypeScript.** The CJS `require('../providers')`
      in `src/server.ts:9` returns `any`, so every method on `Provider`/
      `PassthroughHandler` is asserted, not typechecked. Real bugs (return-shape
      drift in `extractUsage` across providers) are hiding behind the casts.
- [ ] **Replace `ensureColumn` with a real migrations runner.** Add a
      `schema_version` table and version-stamped migration steps. Current scheme
      handles ADD COLUMN only — any rename, FTS5 backfill, or index swap will
      break.
- [ ] **Graceful shutdown.** SIGINT/SIGTERM handler that closes WebSocket
      clients, calls `PRAGMA wal_checkpoint(TRUNCATE)`, then `db.close()`.
- [ ] **Healthcheck port is hardcoded in `Dockerfile`.** Read `$DASHBOARD_PORT`
      via shell expansion, or freeze the in-container port.
- [ ] **Pricing data freshness story.** Document in README how `pricing.js`
      refreshes from LiteLLM, what the fallback path is, and how stale prices
      affect the headline "see what your LLM calls cost" promise.

### P3 — structural refactors, plan after P0/P1 land

- [ ] **Split `src/server.ts` (1,408 lines).** Suggested layout:
      `routes/api.ts`, `routes/otlp.ts`, `proxy/handler.ts`,
      `proxy/streaming.ts`, `health/providers.ts`, `ws/hub.ts`, `static.ts`. The
      top-level dispatcher becomes ~80 lines.
- [ ] **WebSocket heartbeat + dead-client reaping.** `wsClients` set grows
      forever on flaky clients; add ping/pong and drop dead sockets.
- [ ] **Unit tests for OTLP attribute extraction, pricing edge cases, provider
      response normalization.** Current tests spawn the whole server — there's
      no fast inner loop for these modules.
- [ ] **Document listening surface + auth in README.** Explicit warning for
      Docker users binding to `0.0.0.0`.
- [ ] **Port consistency in docs.** Code default is `1337`, `docker-compose`
      default is `3000`, `README.md` uses `1337`, `website/index.html` and
      `website/llms.txt` use `3000`. Pick one (`1337` matches the code default)
      and update everything.

---

## Feature Requests

| Feature          | Priority | Status  |
| ---------------- | -------- | ------- |
| Python SDK       | High     | Planned |
| Go SDK           | Low      | Planned |
| Homebrew formula | Low      | Planned |
| Request replay   | Medium   | Planned |
| Cost alerts      | Medium   | Planned |

---

_Last updated: 2026-05-20 (post-inspection, pre-v0.5)_
