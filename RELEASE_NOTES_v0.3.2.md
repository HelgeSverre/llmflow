# Release Notes - LLMFlow v0.3.2

**Release Date:** 2025-12-21

This patch release fixes critical issues reported during testing, particularly around Anthropic passthrough mode and streaming token tracking.

## Bug Fixes

### 🔴 Critical: Anthropic Passthrough Mode Fixed

**Issue:** The `/passthrough/anthropic/*` endpoint was returning `{"error":"Invalid JSON response","body":""}` instead of the actual Anthropic API response.

**Root Cause:** The passthrough handler was attempting to parse the response as JSON and, upon failure, was returning an error wrapper instead of the raw upstream response.

**Fix:** Passthrough now forwards raw bytes immediately to the client via `res.write(chunk)` while buffering separately for logging. JSON parsing failures no longer affect the client response.

**Impact:** Claude Code, Aider (Anthropic mode), and native Anthropic SDK users can now use LLMFlow passthrough correctly.

### 🟡 Medium: Streaming Token Counts Now Accurate

**Issue:** Dashboard showed 0 tokens for all streaming requests.

**Root Cause:** SSE events were being parsed per TCP chunk, but JSON payloads often span multiple chunks. This caused `parseStreamChunk()` to fail on incomplete JSON, leaving token usage as null.

**Fix:** Both proxy and passthrough streaming handlers now buffer the complete SSE stream and parse it once at the end, ensuring accurate token extraction.

### 🟢 Low: Dashboard API Filtering by Provider

**Issue:** Query parameter `?provider=anthropic` was ignored - `/api/traces` returned all traces.

**Root Cause:** The API endpoint wasn't extracting the `provider` query param, and `db.getTraces()` had no SQL WHERE clause for provider filtering.

**Fix:** 
- Added `provider` and `tag` filter support to `db.getTraces()`
- Added query param extraction in `/api/traces` and `/api/traces/export`

## Clarification

### Proxy Mode Format Conversion (Not a Bug)

The `/anthropic/v1/*` proxy routes intentionally convert Anthropic responses to OpenAI-compatible format. This is by design for consistency across providers.

**For native Anthropic format:** Use `/passthrough/anthropic/v1/messages`

## Upgrade Guide

```bash
# Using npx (always gets latest)
npx llmflow@latest

# Using Docker
docker pull helgesverre/llmflow:v0.3.2
docker pull helgesverre/llmflow:latest

# From source
git pull origin main
npm install
npm start
```

## Full Changelog

[v0.3.1...v0.3.2](https://github.com/HelgeSverre/llmflow/compare/v0.3.1...v0.3.2)

## Files Changed

- `server.js` - Fixed passthrough response handling, streaming token parsing
- `db.js` - Added provider and tag filters to getTraces()
