# LLMFlow Development Plan

> Tracking progress for LLMFlow - local-first LLM observability

## Current State: v0.3 ✅

**Phase 1 & 2 Complete** — LLMFlow now has multi-provider support and all foundational features.

### What's Done

| Feature             | Status                                              |
| ------------------- | --------------------------------------------------- |
| SQLite Storage      | ✅ Persistent, queryable, auto-cleanup              |
| Dynamic Pricing     | ✅ 2000+ models via LiteLLM                         |
| Streaming Support   | ✅ SSE pass-through with full token tracking        |
| Search & Filtering  | ✅ Full filter bar with URL sync                    |
| Hierarchical Spans  | ✅ Full span tree visualization                     |
| JavaScript SDK      | ✅ `trace()`, `span()`, context propagation         |
| Split-Panel UI      | ✅ Langfuse-inspired layout                         |
| OTLP/HTTP Support   | ✅ OpenTelemetry/OpenLLMetry integration            |
| Multi-Provider      | ✅ OpenAI, Anthropic, Ollama, Gemini, Cohere, Azure |
| Passthrough Mode    | ✅ Native API format preservation                   |
| Real-time WebSocket | ✅ Live trace updates                               |
| Dark Mode           | ✅ System preference detection                      |
| Docker Distribution | ✅ Multi-arch images on Docker Hub                  |
| NPX Distribution    | ✅ `npx llmflow` instant start                      |
| Data Export         | ✅ JSON, JSONL, CSV formats                         |
| Keyboard Navigation | ✅ Arrow keys, Esc, shortcuts                       |

### Architecture

```
Your App
    │
    ├── SDK (sdk/index.js) ──────┐
    │   trace(), span()          │
    │                            ▼
    └── OpenAI SDK ──► Proxy (:8080) ──► Provider APIs
                          │
                          ├── /v1/* (OpenAI-compatible)
                          ├── /{provider}/v1/* (normalized)
                          └── /passthrough/{provider}/* (native)
                          │
                          ▼
                      SQLite (db.js)
                          │
                          ▼
                    Dashboard (:3000)
                    (public/app.js)
```

### Supported Providers

| Provider  | Proxy Route       | Passthrough Route          |
| --------- | ----------------- | -------------------------- |
| OpenAI    | `/v1/*` (default) | `/passthrough/openai/*`    |
| Anthropic | `/anthropic/v1/*` | `/passthrough/anthropic/*` |
| Ollama    | `/ollama/v1/*`    | —                          |
| Gemini    | `/gemini/v1/*`    | `/passthrough/gemini/*`    |
| Cohere    | `/cohere/v1/*`    | —                          |
| Azure     | `/azure/v1/*`     | —                          |
| Helicone  | —                 | `/passthrough/helicone/*`  |

### Files

| File                | Purpose                             |
| ------------------- | ----------------------------------- |
| `server.js`         | Express servers (proxy + dashboard) |
| `db.js`             | SQLite database module              |
| `pricing.js`        | Dynamic pricing from LiteLLM        |
| `logger.js`         | Colored console output              |
| `otlp.js`           | OTLP/HTTP trace ingestion           |
| `otlp-logs.js`      | OTLP/HTTP logs ingestion            |
| `otlp-metrics.js`   | OTLP/HTTP metrics ingestion         |
| `otlp-export.js`    | Export to external OTLP backends    |
| `providers/*.js`    | Provider implementations            |
| `sdk/index.js`      | JavaScript tracing SDK              |
| `public/app.js`     | Dashboard frontend logic            |
| `public/index.html` | Dashboard HTML                      |
| `public/style.css`  | Dashboard styles                    |
| `test/demo.js`      | Demo trace generator                |
| `website/`          | Landing page (static HTML/CSS)      |

---

## Next: Phase 3 - Developer Experience

| Task             | Priority | Effort | Status     |
| ---------------- | -------- | ------ | ---------- |
| Python SDK       | High     | M      | 🔲 Planned |
| Go SDK           | Low      | M      | 🔲 Planned |
| Homebrew formula | Low      | M      | 🔲 Planned |

---

## Phase 4 - Advanced Features

| Task                       | Priority | Effort | Status |
| -------------------------- | -------- | ------ | ------ |
| Request replay             | Medium   | M      |        |
| Cost alerts/budgets        | Medium   | M      |        |
| Compare traces (diff view) | Low      | M      |        |
| Prompt versioning          | Low      | L      |        |

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

### Proxy vs Passthrough

- **Proxy** (`/v1/*`, `/{provider}/v1/*`): Normalizes all responses to OpenAI format
- **Passthrough** (`/passthrough/{provider}/*`): Preserves native API format

---

## Out of Scope

These are explicitly not planned:

- Prompt management/versioning (beyond basic tracking)
- Evaluation frameworks
- Team collaboration
- Cloud hosting
- Multi-tenancy

---

_Last updated: December 2024 (v0.3.2)_
