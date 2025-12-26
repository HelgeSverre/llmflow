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

_No open issues at this time._

---

## Feature Requests

| Feature | Priority | Status |
|---------|----------|--------|
| Python SDK | High | Planned |
| Go SDK | Low | Planned |
| Homebrew formula | Low | Planned |
| Request replay | Medium | Planned |
| Cost alerts | Medium | Planned |

---

_Last updated: 2025-12-26 (v0.3.2)_
