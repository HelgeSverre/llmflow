# LLMFlow — Architecture

A C4-style view of LLMFlow: a local-first observability tool for LLM applications. LLMFlow accepts traffic three ways — as an HTTP proxy in front of LLM APIs, as an OTLP receiver, or via its own SDK — and surfaces traces, logs, metrics, and sessions in a Svelte dashboard.

This document tracks the implementation as of `main` (post-`0f287cc`, "Span viewer + session correlation + docs sweep"). Diagrams use Mermaid. The conventions are loose C4 — Context → Container → Component — with one extra section for the data model and one for runtime flows.

## C1 — System Context

```mermaid
graph LR
    subgraph users["Users"]
        DEV["Developer<br/>(local machine)"]
    end

    subgraph emitters["LLM apps / instrumented frameworks"]
        SDK_USER["OpenAI / Anthropic SDK<br/>(base_url override)"]
        OTEL_USER["LangChain · LlamaIndex · Vercel AI SDK<br/>(OTLP HTTP exporter)"]
        LLMFLOW_SDK["llmflow-sdk<br/>(direct span POST)"]
    end

    subgraph llmflow["LLMFlow (this system)"]
        LF["LLMFlow<br/>proxy + dashboard + OTLP receiver"]
    end

    subgraph upstream["Upstream LLM providers"]
        OAI[OpenAI]
        ANT[Anthropic]
        GEM[Google Gemini]
        OLM[Ollama / Groq / Mistral / Azure / Cohere /<br/>Together / OpenRouter / Perplexity]
    end

    subgraph backends["Optional OTLP backends"]
        JAEGER[Jaeger]
        LANGFUSE[Langfuse]
        PHOENIX[Phoenix / Arize]
        HELICONE[Helicone]
        OPIK[Opik]
    end

    DEV -->|"opens dashboard :1337"| LF
    SDK_USER -->|"HTTP :8080<br/>OpenAI-compatible"| LF
    OTEL_USER -->|"OTLP/HTTP :1337/v1/traces·logs·metrics"| LF
    LLMFLOW_SDK -->|"POST /api/spans"| LF
    LF -->|"forwarded request"| OAI
    LF -->|"forwarded request"| ANT
    LF -->|"forwarded request"| GEM
    LF -->|"forwarded request"| OLM
    LF -.->|"OTLP fanout<br/>(opt-in via OTLP_EXPORT_ENDPOINT)"| JAEGER
    LF -.->|"OTLP fanout"| LANGFUSE
    LF -.->|"OTLP fanout"| PHOENIX
    LF -.->|"OTLP fanout"| HELICONE
    LF -.->|"OTLP fanout"| OPIK
```

**Three ingest paths, one storage:**

| Ingest path      | Port             | Endpoint shape                                | What gets stored                                           |
| ---------------- | ---------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Proxy mode       |                  | `/v1/*`, `/anthropic/v1/*`, `/gemini/v1/*`, … | Full request + normalized response, usage, cost, latency   |
| Passthrough mode |                  | `/passthrough/<provider>/*`                   | Raw upstream bytes; logging is side-channel via stream tee |
| OTLP receiver    | (dashboard port) | `/v1/traces`, `/v1/logs`, `/v1/metrics`       | Transformed OTLP spans / log records / metric points       |
| SDK direct       |                  | `POST /api/spans`                             | One synthetic span per call                                |

**Optional egress:** if `OTLP_EXPORT_ENDPOINT` is set, every inserted row is also re-emitted as OTLP to one upstream backend. See `packages/otlp/src/export.js`.

## C2 — Containers

```mermaid
graph TB
    subgraph host["User's machine (single process by default)"]
        subgraph bun["Bun runtime — apps/server/src/server.ts"]
            PROXY["Proxy listener<br/><b>:8080</b><br/>Bun.serve"]
            DASH["Dashboard + API + OTLP listener<br/><b>:1337</b><br/>Bun.serve"]
            WS["WebSocket hub<br/>/ws fanout"]
            STATIC["Static file server<br/>/public/* (built Svelte SPA)"]
        end

        subgraph data["Local data"]
            SQLITE[(SQLite<br/>~/.llmflow/llmflow.db<br/>WAL mode)]
        end

        subgraph spa["Browser — Svelte 5 SPA"]
            DASHBOARD["Dashboard UI<br/>tabs: Timeline · Traces · Sessions ·<br/>Logs · Metrics · Models · Analytics"]
        end
    end

    CLIENT["LLM app<br/>(SDK or OTLP)"] -->|"HTTP"| PROXY
    CLIENT -->|"OTLP"| DASH
    DASHBOARD -->|"fetch /api/*"| DASH
    DASHBOARD <-->|"WebSocket /ws<br/>new_trace · new_span · stats"| WS
    DASH --> STATIC
    PROXY -->|"insertTrace"| SQLITE
    DASH -->|"insertTrace / Log / Metric"| SQLITE
    DASH -->|"read"| SQLITE
    PROXY -->|"trace subscribers hook"| WS
    DASH -.->|"OTLP export (opt-in)"| EXTERNAL["Upstream OTLP backend"]
```

**Two listeners, one process.** The Node launcher `bin/llmflow.js` spawns the bundled Bun server (`dist/server.js`; source in an unbuilt checkout), which boots two `Bun.serve(...)` calls (gated behind `if (import.meta.main)` since `dac0958`):

- **Proxy listener** (`PROXY_PORT`, default `8080`) — only LLM provider traffic.
- **Dashboard listener** (`DASHBOARD_PORT`, default `1337`; startup fails explicitly if the configured port is taken) — serves the SPA, the REST API, the OTLP receiver, and the `/ws` WebSocket on the same port.

**Storage is one SQLite file** (`bun:sqlite`, WAL + `busy_timeout=5000` + `synchronous=NORMAL`, configured in `packages/db/src/index.ts-24`). Three tables — `traces`, `logs`, `metrics` — with trace-aware retention (capped at `MAX_TRACES` span rows, default 10k). The dashboard never talks to SQLite directly; every read goes through `/api/*`.

**Realtime path.** `packages/db/src/index.ts` exposes `subscribeTraces` / `subscribeLogs` / `subscribeMetrics`. The server registers a hook that broadcasts `new_trace` / `new_span` and a throttled `stats` payload to all WebSocket clients. The dashboard's `websocket.svelte.ts` reconnects with backoff and dispatches messages to registered handlers per tab store.

## C3 — Components (server-side)

```mermaid
graph TB
    subgraph apps_server["apps/server/src/server.ts (the dispatcher)"]
        ROUTE_API[handleApiRoute<br/>/api/*]
        ROUTE_OTLP[handleOtlpRoute<br/>/v1/traces · /v1/logs · /v1/metrics]
        ROUTE_PROXY[forwardProxyRequest<br/>/v1/* · /anthropic/v1/* · …]
        ROUTE_PASS[forwardProxyRequest native mode<br/>/passthrough/openai/* · /passthrough/anthropic/* · …]
        STREAM1[StreamSession]
        WS_HUB[wsClients · broadcast]
        STATIC2[serveStaticFile · /public]
        HEALTH[handleProviderHealthCheck<br/>/api/health/providers]
    end

    subgraph providers["@llmflow/providers (TypeScript/ESM)"]
        REG[ProviderRegistry<br/>header + path resolution]
        BASE[BaseProvider<br/>identifyRequestModel · createStreamSession · extractUsage]
        IMPLS["OpenAI · Anthropic · Gemini · Azure ·<br/>Cohere · Ollama · OpenAI-compatible<br/>(Groq / Mistral / Together / OpenRouter / Perplexity)"]
        PASS_HANDLERS["passthroughHandlers<br/>openai · anthropic · gemini · helicone"]
    end

    subgraph otlp_pkg["@llmflow/otlp (CJS)"]
        PROC_T[processOtlpTraces<br/>transformSpan · extractSessionId · …]
        PROC_L[processOtlpLogs]
        PROC_M[processOtlpMetrics]
        EXP[Export hooks<br/>queueTrace · queueLog · queueMetric ·<br/>scheduleFlush]
    end

    subgraph db_pkg["@llmflow/db (TS / ESM)"]
        SCHEMA["initSchema · ensureColumn<br/>traces · logs · metrics tables"]
        WRITES[insertTrace · insertLog · insertMetric<br/>+ prune]
        READS[getTraces · getSpansByTraceId · getSessions ·<br/>getLogs · getMetrics · getStats · getAnalytics]
        HOOKS[subscribeTraces · …<br/>trace subscribers · log subscribers · metric subscribers]
        SAFE[safeJson&lt;T&gt;]
    end

    subgraph pricing_pkg["@llmflow/pricing (CJS)"]
        CALC["calculateCost(model, prompt_tokens, completion_tokens)<br/>LiteLLM-backed + pricing.fallback.json"]
    end

    subgraph shared_pkg["@llmflow/shared"]
        LOGGER[logger.js<br/>log.info · log.error · log.proxy · …]
    end

    ROUTE_PROXY --> REG
    ROUTE_PROXY --> CALC
    ROUTE_PROXY --> WRITES
    ROUTE_PROXY --> STREAM1
    ROUTE_PASS --> PASS_HANDLERS
    ROUTE_PASS --> CALC
    ROUTE_PASS --> WRITES
    ROUTE_PASS --> STREAM2
    STREAM1 --> WRITES
    STREAM2 --> WRITES
    ROUTE_OTLP --> PROC_T --> WRITES
    ROUTE_OTLP --> PROC_L --> WRITES
    ROUTE_OTLP --> PROC_M --> WRITES
    PROC_T --> CALC
    ROUTE_API --> READS
    ROUTE_API --> SAFE
    WRITES --> HOOKS
    HOOKS --> WS_HUB
    HOOKS -.->|"if EXPORT_ENABLED"| EXP
    REG --> IMPLS
    IMPLS --> BASE
    ROUTE_API --> STATIC2
    ROUTE_API --> HEALTH

    %% logger is used everywhere
    LOGGER -.- ROUTE_API
    LOGGER -.- ROUTE_PROXY
    LOGGER -.- PROC_T
```

**File map for the components above:**

| Component              | File                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `handleApiRoute`       | `apps/server/src/server.ts`                                            |
| `handleOtlpRoute`      | `apps/server/src/server.ts`                                            |
| `forwardProxyRequest`  | `apps/server/src/proxy.ts`                                             |
| Native passthrough     | `apps/server/src/proxy.ts`                                             |
| `StreamSession`        | `packages/providers/src/stream.ts`                                     |
| WebSocket hub          | `apps/server/src/server.ts` (`wsClients`), (`broadcast`)               |
| `ProviderRegistry`     | `packages/providers/src/index.ts`                                      |
| `BaseProvider`         | `packages/providers/src/base.ts`                                       |
| OTLP traces processing | `packages/otlp/src/traces.js` (`transformSpan`, `processOtlpTraces`)   |
| OTLP export            | `packages/otlp/src/export.js` (`initExportHooks`)                      |
| DB writes / reads      | `packages/db/src/index.ts` (`insertTrace`, `getTraces`, `getSessions`) |
| `safeJson`             | `packages/db/src/index.ts`                                             |
| Pricing                | `packages/pricing/src/index.js` (`calculateCost`)                      |
| Logger                 | `packages/shared/src/logger.js`                                        |

## C3 — Components (dashboard)

```mermaid
graph TB
    subgraph spa["apps/dashboard — Svelte 5 + Vite 8 SPA (output: /public)"]
        APP[App.svelte<br/>tab router · keyboard nav · stats sync]
        HEADER[Header.svelte<br/>connection status · theme toggle]
        TABS["Tabs.svelte<br/>hash-route between views"]

        subgraph tabs["Tab views"]
            T_TIMELINE[TimelineTab<br/>list + detail]
            T_TRACES[TracesTab<br/>table + detail + SpanWaterfall]
            T_SESSIONS[SessionsTab<br/>list + detail]
            T_LOGS[LogsTab]
            T_METRICS[MetricsTab]
            T_MODELS[ModelsTab]
            T_ANALYTICS[AnalyticsTab]
        end

        subgraph stores["Svelte 5 runes stores"]
            S_TRACES[traces.svelte.ts]
            S_TIMELINE[timeline.svelte.ts]
            S_SESSIONS[sessions.svelte.ts]
            S_LOGS[logs.svelte.ts]
            S_METRICS[metrics.svelte.ts]
            S_MODELS[models.svelte.ts]
            S_ANALYTICS[analytics.svelte.ts]
            S_STATS[stats.svelte.ts]
            S_TABS[tabs.svelte.ts]
            S_THEME[theme.svelte.ts]
            S_WS[websocket.svelte.ts<br/>reconnect + onMessage]
        end

        subgraph wf["Span viewer"]
            SW[SpanWaterfall · SpanRow ·<br/>SpanDetailPanel · viewport.svelte.ts]
        end

        CLIENT[api/client.ts<br/>fetch wrapper]
    end

    APP --> HEADER
    APP --> TABS
    TABS --> T_TIMELINE & T_TRACES & T_SESSIONS & T_LOGS & T_METRICS & T_MODELS & T_ANALYTICS
    T_TRACES --> SW
    T_TIMELINE --> S_TIMELINE
    T_TRACES --> S_TRACES
    T_SESSIONS --> S_SESSIONS
    T_LOGS --> S_LOGS
    T_METRICS --> S_METRICS
    T_MODELS --> S_MODELS
    T_ANALYTICS --> S_ANALYTICS
    APP --> S_STATS
    APP --> S_TABS
    APP --> S_THEME
    APP --> S_WS
    S_TRACES & S_TIMELINE & S_SESSIONS & S_LOGS & S_METRICS & S_MODELS & S_ANALYTICS & S_STATS --> CLIENT
    S_WS -.->|"push new_span · new_trace · stats"| S_TRACES & S_TIMELINE & S_STATS

    SERVER["server :1337<br/>/api/* · /ws"]
    CLIENT -->|"GET /api/*"| SERVER
    S_WS <-->|"WebSocket /ws"| SERVER
```

The SPA is a hash-routed tab switcher (`tabs.svelte.ts`) with one store per data type. Stores hydrate via `api/client.ts` and live-update via the WebSocket store, which is registered once in `App.svelte` (`onMount` -> `initWebSocket`). The span viewer (`SpanWaterfall.svelte`, `viewport.svelte.ts`) is virtualized so very wide traces (~5k spans) stay smooth.

## Data Views

Every tab in the dashboard maps to a specific subset of the schema. This table is the load-bearing one for understanding the product.

| Tab           | API surface                                                                                                                                                                                            | DB query function                                                                                                                                  | What it shows                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Timeline**  | `GET /api/timeline?type=trace\|log&q=&tool=&date_from=`                                                                                                                                                | `getTraces` + `getLogs`, merged + sorted by timestamp                                                                                              | Unified reverse-chronological feed of traces and logs (no metrics)                                                                                                                                                   |
| **Traces**    | `GET /api/traces?limit&offset&model&status&q&provider&session_id&conversation_id&date_from&date_to` -> list; `GET /api/traces/:id` -> detail; `GET /api/traces/:id/tree` -> full span tree             | `getTraces` / `getTraceById` / `getSpansByTraceId`                                                                                                 | Table of root spans; detail view with request/response; tree view feeds `SpanWaterfall`                                                                                                                              |
| **Sessions**  | `GET /api/sessions?limit&offset`; `GET /api/sessions/:id`                                                                                                                                              | `getSessions` / `getSessionCount` / `getSessionTraces`                                                                                             | Multi-trace sessions correlated by `session_id` (filled from `session.id`, `langsmith.trace.session_id`, `traceloop.association.properties.session_id`, `ai.telemetry.metadata.sessionId`, or `service.instance.id`) |
| **Logs**      | `GET /api/logs?service_name&event_name&trace_id&severity_min&q`; `GET /api/logs/filters`; `GET /api/logs/:id`                                                                                          | `getLogs` / `getLogCount` / `getLogById` / `getDistinctLogServices` / `getDistinctEventNames`                                                      | OTLP log records ingested via `/v1/logs`, joinable to traces via `trace_id`                                                                                                                                          |
| **Metrics**   | `GET /api/metrics?name&service_name&metric_type` + `?aggregation=summary`; `GET /api/metrics/filters`; `GET /api/metrics/:id`; `GET /api/metrics/summary?date_from&date_to`; `GET /api/metrics/tokens` | `getMetrics` / `getMetricCount` / `getMetricById` / `getMetricsSummary` / `getTokenUsage` / `getDistinctMetricNames` / `getDistinctMetricServices` | OTLP metric points (sum / gauge / histogram), plus a derived token-usage rollup                                                                                                                                      |
| **Models**    | `GET /api/models` (derived from `db.getStats()`)                                                                                                                                                       | `getStats` (group-by model)                                                                                                                        | Per-model request count, tokens, cost — derived view                                                                                                                                                                 |
| **Analytics** | `GET /api/analytics?days=30` (combined) and individual: `/api/analytics/daily`, `/api/analytics/cost-by-tool`, `/api/analytics/cost-by-model`, `/api/analytics/token-trends?interval=hour&days=7`      | `getDailyStats` / `getCostByTool` / `getCostByModel` / `getTokenTrends`                                                                            | Time-bucketed cost + token charts, with `tool`/`model` cost breakdown sanitized for display                                                                                                                          |

### Read-only API endpoints (full list)

```
GET  /api/health
GET  /api/health/providers
GET  /api/stats
GET  /api/models
GET  /api/traces                       ?limit&offset&model&status&q&provider&session_id&conversation_id&date_from&date_to
GET  /api/traces/:id
GET  /api/traces/:id/tree
GET  /api/traces/export                (CSV export)
GET  /api/sessions                     ?limit&offset
GET  /api/sessions/:id
GET  /api/timeline                     ?type=trace|log&limit&q&tool&date_from
GET  /api/logs                         ?service_name&event_name&trace_id&severity_min&q&limit&offset
GET  /api/logs/filters
GET  /api/logs/:id
GET  /api/metrics                      ?name&service_name&metric_type&aggregation=summary&limit&offset
GET  /api/metrics/filters
GET  /api/metrics/summary              ?date_from&date_to
GET  /api/metrics/tokens
GET  /api/metrics/:id
GET  /api/token-usage
GET  /api/analytics                    ?days=30
GET  /api/analytics/daily              ?days=30
GET  /api/analytics/cost-by-tool       ?days=30
GET  /api/analytics/cost-by-model      ?days=30
GET  /api/analytics/token-trends       ?interval=hour|day&days=7
POST /api/spans                        (SDK direct insertion)
WS   /ws                               new_trace · new_span · stats messages
```

### Ingest endpoints

```
POST /v1/traces      OTLP traces      (port :1337)
POST /v1/logs        OTLP logs        (port :1337)
POST /v1/metrics     OTLP metrics     (port :1337)

/v1/*                OpenAI proxy             (port :8080, default)
/anthropic/v1/*      Anthropic proxy
/gemini/v1/*         Gemini proxy
/azure/v1/*          Azure OpenAI proxy
/cohere/v1/*         Cohere proxy
/ollama/v1/*         Ollama proxy
/groq/v1/*           OpenAI-compatible proxy
/mistral/v1/*        OpenAI-compatible proxy
/together/v1/*       OpenAI-compatible proxy
/openrouter/v1/*     OpenAI-compatible proxy
/perplexity/v1/*     OpenAI-compatible proxy

/passthrough/openai/*       raw bytes, side-channel logging
/passthrough/anthropic/*    raw bytes
/passthrough/gemini/*       raw bytes
/passthrough/helicone/*     raw bytes
```

## Data Model

```mermaid
erDiagram
    TRACES ||--o{ TRACES : "parent_id<br/>(span tree)"
    TRACES ||--o{ LOGS : "trace_id"
    TRACES }o--|| SESSIONS_VIEW : "session_id"

    TRACES {
        TEXT id PK
        INTEGER timestamp
        INTEGER duration_ms
        TEXT provider
        TEXT model
        INTEGER prompt_tokens
        INTEGER completion_tokens
        INTEGER total_tokens
        REAL estimated_cost
        INTEGER status
        TEXT error
        TEXT request_method
        TEXT request_path
        TEXT request_headers "JSON"
        TEXT request_body "JSON"
        INTEGER response_status
        TEXT response_headers "JSON"
        TEXT response_body "JSON"
        TEXT tags "JSON array"
        TEXT trace_id "groups spans"
        TEXT parent_id "span tree"
        TEXT span_type "llm|chain|tool|retriever|…"
        TEXT span_name
        TEXT input "JSON"
        TEXT output "JSON"
        TEXT attributes "JSON"
        TEXT service_name
        TEXT session_id "nullable"
        TEXT conversation_id "nullable"
        TEXT agent_name
    }

    LOGS {
        TEXT id PK
        INTEGER timestamp
        TEXT severity_text
        INTEGER severity_number
        TEXT body
        TEXT trace_id
        TEXT span_id
        TEXT event_name
        TEXT service_name
        TEXT scope_name
        TEXT attributes "JSON"
        TEXT resource_attributes "JSON"
    }

    METRICS {
        TEXT id PK
        INTEGER timestamp
        TEXT name
        TEXT description
        TEXT unit
        TEXT metric_type "sum|gauge|histogram"
        REAL value
        TEXT histogram_data "JSON nullable"
        TEXT service_name
        TEXT scope_name
        TEXT attributes "JSON"
        TEXT resource_attributes "JSON"
    }
```

A few things worth knowing about this schema:

- **Spans are self-referencing.** `traces.parent_id` builds the tree; `traces.trace_id` groups spans belonging to the same root. The "list of traces" view filters to rows where `parent_id IS NULL`.
- **Sessions are a query, not a table.** `getSessions` does a `SELECT … GROUP BY session_id` over `traces`. There's no separate sessions table — sessions exist only as a view over labeled traces.
- **JSON columns everywhere.** Headers, bodies, attributes, and tags are all stored as `TEXT` containing JSON. Reads go through `safeJson` (after `dac0958`) so malformed bodies don't 500 the API.
- **Trace retention evicts logical traces as units.** Indexed group counts track insertion/deletion; the oldest group is evicted on overflow. Oversized traces are evicted in full and bounded eviction markers flag late fragments. Logs and metrics retain their row-based caps (`MAX_LOGS=100000`, `MAX_METRICS=1000000`). See the README for timestamp, partial-data and session ownership policies.

## Runtime Flows

### Proxy request (non-streaming)

```mermaid
sequenceDiagram
    participant App as LLM app
    participant Proxy as :8080 forwardProxyRequest
    participant Registry as ProviderRegistry
    participant Upstream as OpenAI / Anthropic / …
    participant Pricing as @llmflow/pricing
    participant DB as @llmflow/db
    participant Hub as broadcast()
    participant Browser as Dashboard

    App->>Proxy: POST /v1/chat/completions
    Proxy->>Registry: resolve(headers, path)
    Registry-->>Proxy: provider
    Proxy->>Upstream: fetch(transformed body)
    Upstream-->>Proxy: response
    Proxy->>Proxy: provider.extractUsage / normalizeResponse
    Proxy->>Pricing: calculateCost(model, tokens)
    Pricing-->>Proxy: $0.0042
    Proxy->>DB: insertTrace(...)
    DB->>Hub: trace subscribers hook
    Hub->>Browser: WS { type:"new_trace", payload }
    Hub->>Browser: WS { type:"stats", payload } (throttled 1/s)
    Proxy-->>App: 200 + normalized response
```

### Proxy request (streaming SSE)

The streaming path pulls each upstream chunk once. A request-scoped `StreamSession` incrementally parses event boundaries and cumulative usage with bounded capture. Normalized routes emit OpenAI-style chat chunks; native passthrough routes preserve upstream bytes. Backpressure, deadlines and cancellation share the same reader and abort controller.

```mermaid
sequenceDiagram
    participant App as LLM app
    participant Proxy as :8080 forwardProxyRequest
    participant Upstream
    participant DB
    participant Browser
    App->>Proxy: streaming request
    Proxy->>Upstream: fetch with deadline and cancellation
    loop downstream demand
        Upstream-->>Proxy: next byte chunk
        Proxy->>Proxy: StreamSession.push(bytes)
        Proxy-->>App: normalized frames or native bytes
    end
    Proxy->>DB: persist one complete or interrupted span
    DB-->>Browser: summary via WebSocket subscriber
```

### OTLP ingest

```mermaid
sequenceDiagram
    participant Framework as LangChain / Vercel AI / …
    participant Recv as :1337 handleOtlpRoute
    participant Transform as packages/otlp/src/traces.js
    participant Pricing
    participant DB
    participant Export as packages/otlp/src/export.js
    participant Upstream as Optional OTLP backend

    Framework->>Recv: POST /v1/traces (OTLP JSON)
    Recv->>Transform: processOtlpTraces(body)
    loop for each resourceSpan -> scopeSpan -> span
        Transform->>Transform: transformSpan<br/>extractSessionId / Conversation / AgentName /<br/>determineSpanType / extractModel / extractTokens
        Transform->>Pricing: calculateCost
        Transform->>DB: insertTrace
        DB->>Export: trace subscribers (if EXPORT_ENABLED)
        Export->>Export: queueTrace · scheduleFlush
    end
    Recv-->>Framework: { partialSuccess?: { rejectedSpans, errorMessage } }
    Export-->>Upstream: batch POST after FLUSH_INTERVAL_MS or BATCH_SIZE
```

### Dashboard load + live updates

```mermaid
sequenceDiagram
    participant Browser
    participant Static as :1337 (serveStaticFile)
    participant API as :1337 (handleApiRoute)
    participant WS as :1337 (/ws)
    participant DB

    Browser->>Static: GET / → index.html + /assets/*
    Browser->>API: GET /api/stats
    API->>DB: getStats()
    DB-->>API: rows
    API-->>Browser: JSON
    Browser->>API: GET /api/traces (tab init)
    API->>DB: getTraces({...})
    DB-->>API: rows
    API-->>Browser: JSON
    Browser->>WS: WebSocket upgrade
    loop until disconnect
        WS-->>Browser: { type:"new_trace" | "new_span" | "stats", payload }
    end
```

## Module dependency graph

```mermaid
graph LR
    subgraph apps
        SERVER[apps/server]
        DASHBOARD2[apps/dashboard]
    end
    subgraph packages
        DB[@llmflow/db]
        OTLP[@llmflow/otlp]
        PROV[@llmflow/providers]
        PRICE[@llmflow/pricing]
        SHARED[@llmflow/shared]
        SDK[llmflow-sdk]
    end
    SERVER --> DB
    SERVER --> OTLP
    SERVER --> PROV
    SERVER --> PRICE
    SERVER --> SHARED
    OTLP --> DB
    OTLP --> PRICE
    OTLP --> SHARED
    PROV --> SHARED
    DASHBOARD2 -.->|"build output to /public"| SERVER
    SDK -.->|"POST /api/spans"| SERVER
```

`@llmflow/db` and `@llmflow/providers` are TypeScript/ESM. The server imports their types directly. OTLP, pricing, and shared remain CJS (`require()`-style). The dashboard is built and served as static files; it doesn't import server code.

## Cross-cutting concerns

| Concern                 | Where it lives                                                                                       | Notes                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Logging**             | `packages/shared/src/logger.js`                                                                      | `log.info`, `log.error`, `log.proxy`, `log.otlp`, `log.debug`. `VERBOSE=1` enables debug.                                                 |
| **Cost calculation**    | `packages/pricing/src/index.js`                                                                      | Backed by LiteLLM pricing JSON, falls back to bundled `pricing.fallback.json`.                                                            |
| **Provider resolution** | `ProviderRegistry.resolve` in `packages/providers/src/index.ts`                                      | Reads `X-LLMFlow-Provider` header first, then path prefix.                                                                                |
| **OTLP fanout**         | `packages/otlp/src/export.js`                                                                        | One upstream endpoint via `OTLP_EXPORT_ENDPOINT`; batched (`BATCH_SIZE` rows or `FLUSH_INTERVAL_MS`). Headers from `OTLP_EXPORT_HEADERS`. |
| **Realtime fanout**     | `broadcast()` in `apps/server/src/server.ts` over `wsClients` set                                    | Stats throttled to 1/sec; normal close and failed sends remove clients.                                                                   |
| **Static assets**       | `serveStaticFile` at `apps/server/src/server.ts` + `/public/` from `bun run build` of the Svelte SPA | The dashboard ships baked into the npm tarball and the Docker image.                                                                      |
| **CORS**                | wide-open `*` in `startProxyServer`                                                                  | Intentional for the local development workflow.                                                                                           |
| **Auth**                | None today                                                                                           | Local tool: no login/token setup or planned bearer-auth layer.                                                                            |

## Where to start reading

If you only have time for a few files:

1. `apps/server/src/server.ts` — the dispatcher. Top-down: imports, types, hooks, then `handleApiRoute` / `handleOtlpRoute`, with proxy handling in `apps/server/src/proxy.ts`. `main()` at the bottom.
2. `packages/db/src/index.ts` — schema, prepared statements, queries. The shape of every UI view lives here.
3. `packages/otlp/src/traces.js` — how OTLP spans become LLMFlow trace rows (the heuristics that pick `span_type`, `session_id`, `model`, tokens).
4. `apps/dashboard/src/App.svelte` + `apps/dashboard/src/lib/stores/` — the dashboard's tab routing and store-per-view pattern.

## Current scope

This is an intentionally local debugging tool. Refactoring is driven by concrete bugs or features, not file-size or module-count targets. Trace retention uses counters and removes whole traces; logs and metrics retain their existing row-based pruning. Exact tag matching uses json_each; body search uses LIKE. The current fix sequence is tracked in Backlog.md.
