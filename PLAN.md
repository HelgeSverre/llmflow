# LLMFlow Development Plan

> Tracking progress for LLMFlow - local-first LLM observability

## Current State: v0.2 ✅

**Phase 1 Complete** — LLMFlow now has all foundational features working.

### What's Done

| Feature | Status |
|---------|--------|
| SQLite Storage | ✅ Persistent, queryable, auto-cleanup |
| Dynamic Pricing | ✅ 2000+ models via LiteLLM |
| Streaming Support | ✅ SSE pass-through with buffering |
| Search & Filtering | ✅ Full filter bar with URL sync |
| Hierarchical Spans | ✅ Full span tree visualization |
| JavaScript SDK | ✅ `trace()`, `span()`, context propagation |
| Split-Panel UI | ✅ Langfuse-inspired layout |

### Architecture

```
Your App
    │
    ├── SDK (sdk/index.js) ──────┐
    │   trace(), span()          │
    │                            ▼
    └── OpenAI SDK ──► Proxy (:8080) ──► OpenAI API
                          │
                          ▼
                      SQLite (db.js)
                          │
                          ▼
                    Dashboard (:3000)
                    (public/app.js)
```

### Files

| File | Purpose |
|------|---------|
| `server.js` | Express servers (proxy + dashboard) |
| `db.js` | SQLite database module |
| `pricing.js` | Dynamic pricing from LiteLLM |
| `logger.js` | Colored console output |
| `sdk/index.js` | JavaScript tracing SDK |
| `public/app.js` | Dashboard frontend logic |
| `public/index.html` | Dashboard HTML |
| `public/style.css` | Dashboard styles |
| `test/demo.js` | Demo trace generator |

---

## Next: Phase 2 - Multi-Provider

**Goal:** Support Anthropic, Ollama, and other providers.

| Task | Priority | Effort |
|------|----------|--------|
| Provider abstraction layer | High | M |
| Anthropic support | High | S |
| Ollama support | Medium | S |
| Auto-detect provider from request | Medium | S |

### Provider Interface

```javascript
const provider = {
    name: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    detectModel: (req) => req.body.model,
    extractTokens: (res) => ({
        prompt: res.usage.input_tokens,
        completion: res.usage.output_tokens
    }),
    isStreaming: (req) => req.body.stream === true
};
```

---

## Phase 3 - Developer Experience

| Task | Priority | Effort |
|------|----------|--------|
| Python SDK | High | M |
| Dark mode | Medium | S |
| Real-time WebSocket updates | Medium | M |
| Data export (JSON, CSV) | Low | S |
| Keyboard navigation | Low | S |

---

## Phase 4 - Distribution

| Task | Priority | Effort |
|------|----------|--------|
| NPX installer (`npx create-llmflow`) | High | M |
| Docker Hub publishing | Medium | S |
| Homebrew formula | Low | M |

---

## Technical Decisions

### Why SQLite?
- Zero config, single file
- `better-sqlite3` is synchronous = simpler code
- Fast enough for 100k+ traces

### Why No Frontend Framework?
- Simpler distribution
- No build step
- Vanilla JS is sufficient for this scope

### Why Proxy Over SDK-Only?
- Zero code changes
- Works with any language
- Captures everything uniformly

---

## Out of Scope

These are explicitly not planned:

- Prompt management/versioning
- Evaluation frameworks
- Team collaboration
- Cloud hosting
- Multi-tenancy

---

*Last updated: December 2024*
