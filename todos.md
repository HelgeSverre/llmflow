# LLMFlow Issues Found During Testing

Testing performed on 2025-12-21 against LLMFlow v0.3.1

---

## Critical Issues

### 1. Anthropic Passthrough Mode Broken

**Severity:** Critical
**Affects:** Claude Code, Aider (Anthropic mode), Native Anthropic SDK

**Problem:**
The `/passthrough/anthropic` endpoint fails to return valid JSON responses. Requests are processed successfully on the server side (logs show "OK"), but the response sent back to the client is malformed.

**Observed Behavior:**
```bash
curl http://localhost:8080/passthrough/anthropic/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}'

# Returns:
{"error":"Invalid JSON response","body":""}
```

**Server Logs:**
```
18:27:53.015 OK claude-sonnet-4-20250514 172ms
```

The server completes the request successfully, but the response body is empty when returned to the client.

**Impact:**
- Claude Code cannot be used with LLMFlow (returns "API Error: 404")
- Aider with `--anthropic-api-base` fails
- Any application using the native Anthropic SDK through passthrough fails

**Expected Behavior:**
Passthrough should return the native Anthropic API response format unchanged.

---

### 2. Anthropic Proxy Mode Converts Response Format

**Severity:** Medium
**Affects:** Native Anthropic SDK users

**Problem:**
The `/anthropic/v1` proxy endpoint converts Anthropic responses to OpenAI-compatible format. This breaks applications expecting native Anthropic format.

**Observed Behavior:**
```python
# Using Anthropic SDK through proxy
response = client.messages.create(...)

# Response has OpenAI structure mixed with Anthropic wrapper:
Message(
    id='msg_...',
    content=None,  # Native field is empty!
    model='claude-sonnet-4-20250514',
    role=None,
    stop_reason=None,
    type=None,
    usage=Usage(...),
    object='chat.completion',  # OpenAI field
    choices=[{'index': 0, 'message': {'role': 'assistant', 'content': 'OK'}, 'finish_reason': 'stop'}]  # OpenAI structure
)
```

**Expected Behavior:**
Either:
1. Proxy mode should preserve native format (like passthrough claims to do), OR
2. Documentation should clearly state that proxy mode converts to OpenAI format

---

## Medium Issues

### 3. Streaming Responses Show 0 Token Count

**Severity:** Medium
**Affects:** Token tracking accuracy for streaming requests

**Problem:**
When streaming is enabled (`"stream": true`), the dashboard shows 0 tokens for both input and output.

**Observed Behavior:**
```
Model: gpt-4o-mini
Tokens: 0 in + 0 out = 0 total
Cost: $0.000000
Duration: 624ms
Status: 200
```

Non-streaming requests correctly show token counts:
```
Model: gpt-4o-mini-2024-07-18
Tokens: 11 total
Cost: $0.0000
Duration: 1036ms
```

**Expected Behavior:**
Token counts should be calculated from the aggregated streaming chunks.

---

### 4. Dashboard API Filtering May Not Work

**Severity:** Low
**Affects:** Dashboard usability

**Problem:**
Query parameters for filtering traces don't appear to work:

```bash
curl "http://localhost:3000/api/traces?provider=anthropic"
# Returns all 50 traces, not filtered

curl "http://localhost:3000/api/traces?model=gpt"
# Returns 0 traces
```

**Expected Behavior:**
Query parameters should filter traces by provider, model, date range, etc.

---

## Summary Table

| Issue | Severity | Status | Workaround |
|-------|----------|--------|------------|
| Passthrough broken | Critical | Unfixed | Use proxy mode (but format changes) |
| Format conversion | Medium | By design? | None - must handle OpenAI format |
| Streaming tokens = 0 | Medium | Unfixed | Use non-streaming requests |
| API filtering broken | Low | Unfixed | Filter client-side |

---

## Test Environment

- LLMFlow version: 0.3.1
- Installation method: `npx llmflow`
- OS: macOS Darwin 24.6.0
- Node.js: (via npx)
- Tested providers: OpenAI, Anthropic
- Tested tools: Claude Code, Aider
