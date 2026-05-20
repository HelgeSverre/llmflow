# Span Viewer + Session Correlation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a virtualized span timeline viewer + cross-trace session correlation, so a long-running coding agent (Glue) shows up as one navigable session containing many traces, each rendered as a fast, scrubbable waterfall.

**Architecture:** Backend extends OTLP ingestion to extract `session_id` and `conversation_id` from OTel official / OpenInference / LangSmith / Traceloop / Vercel AI SDK attribute paths (priority order). New columns on `traces` table, new `/api/sessions` endpoints. Frontend ships a new `SpanWaterfall` component (virtualized DOM rows + sticky time axis, per `docs/reference/trace-span-viewer-ui/04-rendering-techniques.md`) replacing the current `SpanTree.svelte`. A new Sessions tab lists sessions grouped from multiple traces. Glue gets a one-line change to emit `session.id` per CLI session.

**Tech Stack:** Bun + bun:sqlite + Svelte 5 (runes: `$state`, `$derived`, `$effect`) + Vite 8. No new runtime deps.

**References:**
- `docs/reference/trace-span-viewer-ui/01-llm-tools-survey.md` (UI patterns to steal/avoid)
- `docs/reference/trace-span-viewer-ui/02-apm-tools-survey.md` (general waterfall conventions)
- `docs/reference/trace-span-viewer-ui/03-otel-gen-ai-data-model.md` (session attribute priority chain, schema delta)
- `docs/reference/trace-span-viewer-ui/04-rendering-techniques.md` (concrete rendering recipe)

**Session attribute priority chain** (per doc 03):
1. `session.id` (OpenInference — cleanest)
2. `langsmith.trace.session_id`
3. `traceloop.association.properties.session_id`
4. `ai.telemetry.metadata.sessionId` (Vercel AI SDK)
5. Resource attribute `service.instance.id` (last-resort heuristic for long-lived processes)
6. NULL

**Conversation attribute priority chain:**
1. `gen_ai.conversation.id` (OTel official, Development status)
2. `langsmith.trace.session_id` (LangSmith conflates these)
3. `traceloop.association.properties.thread_id`
4. `ai.telemetry.metadata.threadId`
5. NULL

**Scope NOT in this plan:** OTel v1.38 structured-message ingestion, FTS5 search, OTLP v1.38 consolidated event parsing, full provider TS port. Each is its own follow-up — see `todos.md`.

---

## File Structure

### Backend changes

- **Modify** `packages/db/src/index.ts` — Add columns via `ensureColumn`, extend `Trace` interface, extend `insertTrace`, add `getSessions`, `getSessionTraces` queries. Extend `getTraces` filter to accept `session_id`.
- **Modify** `packages/otlp/src/traces.js` — Add `extractSessionId` and `extractConversationId` with priority-order resolution, populate new columns in `insertTrace` call. Drop the `service.name → provider` fallback (already removed in PR #1; verify still gone).
- **Modify** `apps/server/src/server.ts` — Add `/api/sessions` (list, paginated) and `/api/sessions/:id` (detail with traces). Add `session_id` to the existing `/api/traces` filter parser.

### Frontend changes

- **Create** `apps/dashboard/src/lib/trace/viewport.svelte.ts` — `TraceViewport` class with `$state.raw` tree + `$state` flattened rows + `$derived` visible range. ~150 LOC.
- **Create** `apps/dashboard/src/lib/components/trace-viewer/SpanWaterfall.svelte` — Virtualized scroll container with sticky time axis.
- **Create** `apps/dashboard/src/lib/components/trace-viewer/SpanRow.svelte` — One row: indent + caret + name + bar + duration.
- **Create** `apps/dashboard/src/lib/components/trace-viewer/SpanDetailPanel.svelte` — Selected-span info (attributes, input, output, messages).
- **Create** `apps/dashboard/src/lib/components/trace-viewer/SpanColors.ts` — Okabe-Ito palette mapped to span types.
- **Modify** `apps/dashboard/src/lib/components/traces/TraceDetail.svelte` — Replace `<SpanTree>` with `<SpanWaterfall>` + `<SpanDetailPanel>`.
- **Delete** `apps/dashboard/src/lib/components/traces/SpanTree.svelte` — Superseded.

### Sessions UI

- **Create** `apps/dashboard/src/lib/stores/sessions.svelte.ts` — Sessions list + selected session detail.
- **Create** `apps/dashboard/src/lib/components/sessions/SessionsTab.svelte` — Top-level tab.
- **Create** `apps/dashboard/src/lib/components/sessions/SessionList.svelte` — Paginated table.
- **Create** `apps/dashboard/src/lib/components/sessions/SessionDetail.svelte` — Traces in session, click-through to viewer.
- **Modify** `apps/dashboard/src/lib/stores/tabs.svelte.ts` — Register `sessions` tab.
- **Modify** `apps/dashboard/src/App.svelte` — Mount `<SessionsTab>` when active.

### Cross-system

- **Modify** `../glue/packages/glue_harness/lib/src/observability/otlp_http_trace_sink.dart` — Emit a stable `session.id` resource attribute per CLI session.

### Tests

- **Create** `apps/server/test/sessions-e2e.js` — End-to-end: ingest 3 traces with same `session.id` → `GET /api/sessions/:id` returns them all.
- **Create** `apps/server/test/otlp-session-extraction.test.js` — Unit: each OTel/OpenInference/LangSmith/Traceloop/Vercel path resolves correctly.
- **Create** `apps/dashboard/src/lib/trace/viewport.test.ts` — Vitest unit tests for viewport state class (visible range, expand/collapse, time-pixel math).

---

## Task list

### Task 1: Schema — add session_id, conversation_id, agent_name columns

**Files:**
- Modify: `packages/db/src/index.ts:73-85` (the `ensureColumn` block)

- [ ] **Step 1: Add the three columns**

In `packages/db/src/index.ts`, after the existing `ensureColumn('service_name', 'TEXT')` line, add:

```ts
ensureColumn('session_id', 'TEXT')
ensureColumn('conversation_id', 'TEXT')
ensureColumn('agent_name', 'TEXT')

db.exec('CREATE INDEX IF NOT EXISTS idx_traces_session_id ON traces(session_id)')
db.exec('CREATE INDEX IF NOT EXISTS idx_traces_conversation_id ON traces(conversation_id)')
```

- [ ] **Step 2: Boot the server against a fresh DB to verify migration runs**

```bash
cd apps/server
DATA_DIR=$(mktemp -d -t llmflow-schema-check) PROXY_PORT=19200 DASHBOARD_PORT=19201 \
  timeout 3 bun run src/server.ts
```

Expected: prints `[llmflow] Dashboard: ...` and exits via timeout (success). No SQL errors.

- [ ] **Step 3: Verify columns exist via PRAGMA**

```bash
cd apps/server
DATA_DIR=$(mktemp -d -t llmflow-schema-pragma) PROXY_PORT=19202 DASHBOARD_PORT=19203 \
  bun run src/server.ts &
SERVER_PID=$!
sleep 1
DBP="$DATA_DIR/data.db" bun -e "const{Database}=require('bun:sqlite');const d=new Database(process.env.DBP,{readonly:true});console.log(d.query('PRAGMA table_info(traces)').all().map(c=>c.name).join(','))"
kill $SERVER_PID 2>/dev/null
```

Expected output includes `...,session_id,conversation_id,agent_name`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): add session_id, conversation_id, agent_name columns + indexes

Backed by the priority-order extraction chain documented in
docs/reference/trace-span-viewer-ui/03-otel-gen-ai-data-model.md.
ensureColumn ADD COLUMN handles upgrade of existing user DBs."
```

---

### Task 2: Update insertTrace to bind the new columns

**Files:**
- Modify: `packages/db/src/index.ts` — `insertTraceStmt` SQL, `Trace` interface, `insertTrace` body

- [ ] **Step 1: Extend the `Trace` interface**

Find the `export interface Trace` block (around line 264) and add three fields immediately after `service_name`:

```ts
  service_name?: string
  session_id?: string | null
  conversation_id?: string | null
  agent_name?: string | null
```

- [ ] **Step 2: Extend the prepared INSERT statement**

Find `const insertTraceStmt = db.query(...)` (around line 152) and add the new columns to both the column list and the parameter list:

```ts
const insertTraceStmt = db.query(`
    INSERT INTO traces (
        id, timestamp, duration_ms,
        provider, model,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost, status, error,
        request_method, request_path, request_headers, request_body,
        response_status, response_headers, response_body,
        tags, trace_id, parent_id,
        span_type, span_name, input, output, attributes, service_name,
        session_id, conversation_id, agent_name
    ) VALUES (
        $id, $timestamp, $duration_ms,
        $provider, $model,
        $prompt_tokens, $completion_tokens, $total_tokens,
        $estimated_cost, $status, $error,
        $request_method, $request_path, $request_headers, $request_body,
        $response_status, $response_headers, $response_body,
        $tags, $trace_id, $parent_id,
        $span_type, $span_name, $input, $output, $attributes, $service_name,
        $session_id, $conversation_id, $agent_name
    )
`)
```

- [ ] **Step 3: Bind new params in `insertTrace`**

Find `export function insertTrace(trace: Trace)` (around line 396) and add three lines in the `.run({ ... })` call after `$service_name`:

```ts
        $service_name: trace.service_name || null,
        $session_id: trace.session_id || null,
        $conversation_id: trace.conversation_id || null,
        $agent_name: trace.agent_name || null,
```

- [ ] **Step 4: Smoke-test by inserting a trace via OTLP and inspecting the row**

```bash
cd apps/server
DATA_DIR=$(mktemp -d -t llmflow-insert) PROXY_PORT=19204 DASHBOARD_PORT=19205 \
  bun run src/server.ts &
SERVER_PID=$!
sleep 1
curl -sS -X POST http://127.0.0.1:19205/v1/traces \
  -H 'Content-Type: application/json' \
  -d '{"resourceSpans":[{"resource":{"attributes":[]},"scopeSpans":[{"spans":[{"traceId":"01020304050607080910111213141516","spanId":"1112131415161718","name":"hello","startTimeUnixNano":"1700000000000000000","endTimeUnixNano":"1700000000100000000","attributes":[],"status":{"code":1}}]}]}]}'
DBP="$DATA_DIR/data.db" bun -e "const{Database}=require('bun:sqlite');const d=new Database(process.env.DBP,{readonly:true});console.log(d.query('SELECT id, session_id, conversation_id, agent_name FROM traces').all())"
kill $SERVER_PID 2>/dev/null
```

Expected: one row with `session_id: null, conversation_id: null, agent_name: null`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): bind session_id, conversation_id, agent_name in insertTrace"
```

---

### Task 3: OTLP extractor — pull session/conversation attrs with priority chain

**Files:**
- Modify: `packages/otlp/src/traces.js` — Add `extractSessionId` and `extractConversationId` helpers, populate new columns in the `db.insertTrace(...)` call.
- Test: `apps/server/test/otlp-session-extraction.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/server/test/otlp-session-extraction.test.js`:

```js
const assert = require('node:assert');
const { processOtlpTraces } = require('@llmflow/otlp/traces');
const db = require('@llmflow/db');

function makeSpan(attrs) {
    return {
        resourceSpans: [{
            resource: { attributes: [] },
            scopeSpans: [{
                spans: [{
                    traceId: Math.random().toString(36).slice(2).padEnd(32, '0'),
                    spanId: Math.random().toString(36).slice(2).padEnd(16, '0'),
                    name: 'test',
                    startTimeUnixNano: String(1700000000_000000000n),
                    endTimeUnixNano: String(1700000000_100000000n),
                    attributes: Object.entries(attrs).map(([k, v]) => ({ key: k, value: { stringValue: String(v) } })),
                    status: { code: 1 }
                }]
            }]
        }]
    };
}

function lastTraceFor(id) {
    return db.getTraceById(id);
}

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✓', name); passed++; }
    catch (e) { console.log('✗', name, '—', e.message); failed++; }
}

test('OpenInference session.id', () => {
    const payload = makeSpan({ 'session.id': 'sess-123' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'sess-123');
});

test('LangSmith langsmith.trace.session_id', () => {
    const payload = makeSpan({ 'langsmith.trace.session_id': 'ls-456' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'ls-456');
});

test('Traceloop traceloop.association.properties.session_id', () => {
    const payload = makeSpan({ 'traceloop.association.properties.session_id': 'tl-789' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'tl-789');
});

test('Vercel AI SDK ai.telemetry.metadata.sessionId', () => {
    const payload = makeSpan({ 'ai.telemetry.metadata.sessionId': 'v-321' });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'v-321');
});

test('Priority: session.id beats langsmith and traceloop', () => {
    const payload = makeSpan({
        'session.id': 'winner',
        'langsmith.trace.session_id': 'loser-1',
        'traceloop.association.properties.session_id': 'loser-2'
    });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.session_id, 'winner');
});

test('Conversation: gen_ai.conversation.id wins over traceloop thread_id', () => {
    const payload = makeSpan({
        'gen_ai.conversation.id': 'conv-A',
        'traceloop.association.properties.thread_id': 'conv-B'
    });
    const sid = payload.resourceSpans[0].scopeSpans[0].spans[0].spanId;
    processOtlpTraces(payload);
    const row = lastTraceFor(sid);
    assert.strictEqual(row.conversation_id, 'conv-A');
});

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/server && DATA_DIR=$(mktemp -d) bun run test/otlp-session-extraction.test.js
```

Expected: All tests FAIL with `session_id: undefined` or similar — extractor not yet written.

- [ ] **Step 3: Implement the extractors**

In `packages/otlp/src/traces.js`, after the existing `extractAttributes` function and before `transformSpan`, add:

```js
/**
 * Resolve a session ID from span + resource attribute bags.
 * Priority: OpenInference > LangSmith > Traceloop > Vercel AI SDK.
 * service.instance.id is a last-resort heuristic for daemons that never set
 * an explicit session.id — same physical process, same session.
 */
function extractSessionId(attrs, resourceAttrs) {
    return attrs['session.id']
        || attrs['langsmith.trace.session_id']
        || attrs['traceloop.association.properties.session_id']
        || attrs['ai.telemetry.metadata.sessionId']
        || resourceAttrs['service.instance.id']
        || null;
}

/**
 * Resolve a conversation/thread ID. Conversation = one chat thread.
 * Distinct from session — a session can contain many conversations.
 * Priority: OTel official (Development) > Traceloop > Vercel AI SDK.
 * NB: LangSmith conflates conversation and session in `langsmith.trace.session_id`;
 *     we read it once into session_id and leave conversation_id null rather
 *     than duplicate.
 */
function extractConversationId(attrs) {
    return attrs['gen_ai.conversation.id']
        || attrs['traceloop.association.properties.thread_id']
        || attrs['ai.telemetry.metadata.threadId']
        || null;
}

function extractAgentName(attrs) {
    return attrs['gen_ai.agent.name']
        || attrs['gen_ai.agent.id']
        || null;
}
```

- [ ] **Step 4: Wire them into transformSpan's return object**

Find the return object in `transformSpan` (around line 257-280, just after `parent_id`). Add three lines:

```js
        trace_id: traceId,
        parent_id: parentId,
        session_id: extractSessionId(attrs, resourceAttrs),
        conversation_id: extractConversationId(attrs),
        agent_name: extractAgentName(attrs),
        span_type: spanType,
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd apps/server && DATA_DIR=$(mktemp -d) bun run test/otlp-session-extraction.test.js
```

Expected: `Passed: 6, Failed: 0`.

- [ ] **Step 6: Commit**

```bash
git add packages/otlp/src/traces.js apps/server/test/otlp-session-extraction.test.js
git commit -m "feat(otlp): extract session_id, conversation_id, agent_name from OTel attrs

Priority chain matches docs/reference/trace-span-viewer-ui/03-otel-gen-ai-data-model.md
section 'Multi-turn / session'. Test covers OpenInference, LangSmith,
Traceloop, Vercel AI SDK, plus priority ordering."
```

---

### Task 4: Extend getTraces filter to accept session_id

**Files:**
- Modify: `packages/db/src/index.ts` — `TraceFilters` type, `getTraces` body
- Modify: `apps/server/src/server.ts:482` — Parse `session_id` query param

- [ ] **Step 1: Add session_id to filter type and where-clause**

Find `interface TraceFilters` in `packages/db/src/index.ts` and add:

```ts
  session_id?: string
  conversation_id?: string
```

In `getTraces`, after the existing `provider` filter block (around line 483), add:

```ts
    if (filters.session_id) {
        where.push('session_id = $session_id')
        params.$session_id = filters.session_id
    }

    if (filters.conversation_id) {
        where.push('conversation_id = $conversation_id')
        params.$conversation_id = filters.conversation_id
    }
```

- [ ] **Step 2: Parse the query params in the API**

In `apps/server/src/server.ts`, find the `/api/traces` GET handler (around line 469-483) and add two lines:

```ts
            if (url.searchParams.get('provider')) filters.provider = url.searchParams.get('provider')!
            if (url.searchParams.get('session_id')) filters.session_id = url.searchParams.get('session_id')!
            if (url.searchParams.get('conversation_id')) filters.conversation_id = url.searchParams.get('conversation_id')!
```

- [ ] **Step 3: Verify via curl**

```bash
# (start server with a DB containing a trace tagged session_id=demo-1)
curl -sS "http://127.0.0.1:3000/api/traces?session_id=demo-1" | head -c 200
```

Expected: JSON array of traces matching `session_id=demo-1`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/index.ts apps/server/src/server.ts
git commit -m "feat(api): session_id + conversation_id filters on GET /api/traces"
```

---

### Task 5: New DB queries — getSessions, getSessionTraces

**Files:**
- Modify: `packages/db/src/index.ts` — Add two exported functions after `getDistinctModels`.

- [ ] **Step 1: Add getSessions**

After `getDistinctModels` (around line 563), add:

```ts
export interface SessionSummary {
    session_id: string
    first_seen: number
    last_seen: number
    trace_count: number
    total_cost: number
    total_tokens: number
    agent_name: string | null
    service_name: string | null
}

export function getSessions({ limit = 50, offset = 0 } = {}): SessionSummary[] {
    return db.query(`
        SELECT
            session_id,
            MIN(timestamp) AS first_seen,
            MAX(timestamp) AS last_seen,
            COUNT(DISTINCT trace_id) AS trace_count,
            COALESCE(SUM(estimated_cost), 0) AS total_cost,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            (SELECT agent_name FROM traces t2 WHERE t2.session_id = traces.session_id AND agent_name IS NOT NULL LIMIT 1) AS agent_name,
            (SELECT service_name FROM traces t3 WHERE t3.session_id = traces.session_id AND service_name IS NOT NULL LIMIT 1) AS service_name
        FROM traces
        WHERE session_id IS NOT NULL
        GROUP BY session_id
        ORDER BY last_seen DESC
        LIMIT $limit OFFSET $offset
    `).all({ $limit: limit, $offset: offset }) as SessionSummary[]
}

export function getSessionTraces(session_id: string) {
    return db.query(`
        SELECT
            trace_id,
            MIN(timestamp) AS started_at,
            MAX(timestamp + COALESCE(duration_ms, 0)) AS ended_at,
            COALESCE(SUM(estimated_cost), 0) AS cost,
            COALESCE(SUM(total_tokens), 0) AS tokens,
            COUNT(*) AS span_count,
            MAX(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS has_error
        FROM traces
        WHERE session_id = $session_id
        GROUP BY trace_id
        ORDER BY started_at ASC
    `).all({ $session_id: session_id })
}

export function getSessionCount(): number {
    const r = db.query('SELECT COUNT(DISTINCT session_id) AS cnt FROM traces WHERE session_id IS NOT NULL').get() as { cnt: number }
    return r.cnt
}
```

- [ ] **Step 2: Smoke-test the queries**

```bash
cd apps/server
DATA_DIR=$(mktemp -d -t llmflow-sessions) PROXY_PORT=19206 DASHBOARD_PORT=19207 \
  bun run src/server.ts &
SERVER_PID=$!
sleep 1
# Insert two traces with the same session_id
for i in 1 2; do
  curl -sS -X POST http://127.0.0.1:19207/v1/traces \
    -H 'Content-Type: application/json' \
    -d '{"resourceSpans":[{"resource":{"attributes":[]},"scopeSpans":[{"spans":[{"traceId":"010203040506070809101112131415'$i'6","spanId":"1112131415161718","name":"hello","startTimeUnixNano":"1700000000000000000","endTimeUnixNano":"1700000000100000000","attributes":[{"key":"session.id","value":{"stringValue":"sess-demo"}}],"status":{"code":1}}]}]}]}' > /dev/null
done
DBP="$DATA_DIR/data.db" bun -e "const db=require('@llmflow/db');console.log('sessions:', db.getSessions());console.log('traces in sess-demo:', db.getSessionTraces('sess-demo'))"
kill $SERVER_PID 2>/dev/null
```

Expected: One session entry with `trace_count: 2`, two trace entries under it.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): getSessions, getSessionTraces, getSessionCount"
```

---

### Task 6: API routes — GET /api/sessions, GET /api/sessions/:id

**Files:**
- Modify: `apps/server/src/server.ts` — Add two route handlers inside `handleApiRoute`.

- [ ] **Step 1: Add the routes**

In `apps/server/src/server.ts`, inside `handleApiRoute`, after the `/api/traces/export` route (find a logical home — anywhere in the chain works), add:

```ts
        // Sessions list
        if (pathname === '/api/sessions' && method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || '50')
            const offset = Number(url.searchParams.get('offset') || '0')
            return Response.json({
                sessions: db.getSessions({ limit, offset }),
                total: db.getSessionCount()
            })
        }

        // Session detail
        if (pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'GET') {
            const id = decodeURIComponent(pathname.split('/').pop()!)
            const traces = db.getSessionTraces(id)
            if (!traces.length) return Response.json({ error: 'Session not found' }, { status: 404 })

            const totals = (traces as Record<string, unknown>[]).reduce((acc, t) => ({
                cost: acc.cost + ((t.cost as number) || 0),
                tokens: acc.tokens + ((t.tokens as number) || 0),
                spans: acc.spans + ((t.span_count as number) || 0),
                errors: acc.errors + ((t.has_error as number) || 0)
            }), { cost: 0, tokens: 0, spans: 0, errors: 0 })

            return Response.json({
                session_id: id,
                traces,
                summary: totals
            })
        }
```

- [ ] **Step 2: Verify both routes**

```bash
curl -sS "http://127.0.0.1:3000/api/sessions" | jq '.'
curl -sS "http://127.0.0.1:3000/api/sessions/sess-demo" | jq '.'
```

Expected: First returns `{ sessions: [...], total: N }`. Second returns `{ session_id, traces: [...], summary: {...} }`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/server.ts
git commit -m "feat(api): GET /api/sessions and /api/sessions/:id"
```

---

### Task 7: Frontend — TraceViewport state class

**Files:**
- Create: `apps/dashboard/src/lib/trace/viewport.svelte.ts`
- Test: `apps/dashboard/src/lib/trace/viewport.test.ts`

- [ ] **Step 1: Define the API shape (failing test)**

Create `apps/dashboard/src/lib/trace/viewport.test.ts` (Vitest):

```ts
import { describe, it, expect } from 'vitest'
import { TraceViewport, type SpanInput } from './viewport.svelte'

const trace: SpanInput[] = [
    { id: 'root', parent_id: undefined, name: 'root', start_time: 0, duration_ms: 100, span_type: 'agent' },
    { id: 'a', parent_id: 'root', name: 'llm-call', start_time: 10, duration_ms: 40, span_type: 'llm' },
    { id: 'b', parent_id: 'root', name: 'tool-use', start_time: 60, duration_ms: 30, span_type: 'tool' }
]

describe('TraceViewport', () => {
    it('flattens the tree depth-first', () => {
        const v = new TraceViewport(trace)
        expect(v.rows.map(r => r.id)).toEqual(['root', 'a', 'b'])
    })

    it('computes pixel ranges relative to the root duration', () => {
        const v = new TraceViewport(trace)
        v.setViewportWidth(1000)  // total = 100ms → 10px per ms
        const a = v.rows.find(r => r.id === 'a')!
        expect(a.xPx).toBe(100)        // start_time 10ms × 10
        expect(a.widthPx).toBe(400)    // duration 40ms × 10
    })

    it('expand/collapse hides descendants', () => {
        const v = new TraceViewport(trace)
        v.collapse('root')
        expect(v.rows.map(r => r.id)).toEqual(['root'])
        v.expand('root')
        expect(v.rows.map(r => r.id)).toEqual(['root', 'a', 'b'])
    })

    it('selectedId updates and is observable', () => {
        const v = new TraceViewport(trace)
        v.select('a')
        expect(v.selectedId).toBe('a')
        expect(v.selectedSpan?.name).toBe('llm-call')
    })
})
```

- [ ] **Step 2: Install vitest + configure it to compile Svelte 5 runes**

```bash
cd apps/dashboard
bun add -d vitest jsdom
```

Add a test script to `apps/dashboard/package.json`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

Create `apps/dashboard/vitest.config.ts` — vitest needs the svelte plugin to compile `.svelte.ts` files that use runes (`$state`, `$derived`):

```ts
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
    plugins: [svelte({ hot: false })],
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.ts'],
        globals: false,
    },
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/dashboard && bun run test
```

Expected: FAIL — module `./viewport.svelte` does not exist.

- [ ] **Step 4: Implement TraceViewport**

Create `apps/dashboard/src/lib/trace/viewport.svelte.ts`:

```ts
import { SvelteSet } from 'svelte/reactivity'

export interface SpanInput {
    id: string
    parent_id?: string | undefined
    name: string
    start_time: number       // ms since trace root
    duration_ms: number
    span_type?: string
    [key: string]: unknown
}

export interface SpanRow {
    id: string
    parent_id?: string | undefined
    name: string
    depth: number
    start_time: number
    duration_ms: number
    span_type?: string
    hasChildren: boolean
    xPx: number              // left offset within waterfall canvas
    widthPx: number          // bar width (min 2px enforced for visibility)
}

interface InternalNode {
    span: SpanInput
    depth: number
    children: InternalNode[]
}

const MIN_BAR_PX = 2

export class TraceViewport {
    #spans: SpanInput[]
    #tree: InternalNode[]
    // SvelteSet (not plain Set) so mutations trigger reactivity in $derived rows.
    #expanded = new SvelteSet<string>()
    #viewportWidth = $state(0)
    selectedId: string | null = $state(null)

    constructor(spans: SpanInput[]) {
        this.#spans = spans
        this.#tree = this.#buildTree(spans)
        // Default: every node with children is expanded.
        for (const node of this.#walk(this.#tree)) {
            if (node.children.length) this.#expanded.add(node.span.id)
        }
    }

    get rootStart(): number {
        return Math.min(...this.#spans.map(s => s.start_time))
    }

    get totalDuration(): number {
        const end = Math.max(...this.#spans.map(s => s.start_time + s.duration_ms))
        return Math.max(1, end - this.rootStart)
    }

    setViewportWidth(px: number) {
        this.#viewportWidth = px
    }

    expand(id: string) { this.#expanded.add(id) }
    collapse(id: string) { this.#expanded.delete(id) }
    toggle(id: string) {
        if (this.#expanded.has(id)) this.collapse(id)
        else this.expand(id)
    }

    select(id: string | null) { this.selectedId = id }

    rows = $derived.by((): SpanRow[] => {
        const pxPerMs = this.#viewportWidth > 0 ? this.#viewportWidth / this.totalDuration : 0
        const out: SpanRow[] = []
        const root = this.rootStart
        const walk = (node: InternalNode) => {
            const s = node.span
            out.push({
                id: s.id,
                parent_id: s.parent_id,
                name: s.name,
                depth: node.depth,
                start_time: s.start_time,
                duration_ms: s.duration_ms,
                span_type: s.span_type,
                hasChildren: node.children.length > 0,
                xPx: (s.start_time - root) * pxPerMs,
                widthPx: Math.max(MIN_BAR_PX, s.duration_ms * pxPerMs)
            })
            if (this.#expanded.has(s.id)) {
                for (const c of node.children) walk(c)
            }
        }
        for (const n of this.#tree) walk(n)
        return out
    })

    selectedSpan = $derived.by((): SpanInput | null => {
        if (!this.selectedId) return null
        return this.#spans.find(s => s.id === this.selectedId) || null
    })

    #buildTree(spans: SpanInput[]): InternalNode[] {
        const byId = new Map<string, InternalNode>()
        for (const span of spans) byId.set(span.id, { span, depth: 0, children: [] })
        const roots: InternalNode[] = []
        for (const node of byId.values()) {
            const pid = node.span.parent_id
            if (pid && byId.has(pid)) {
                const parent = byId.get(pid)!
                node.depth = parent.depth + 1
                parent.children.push(node)
            } else {
                roots.push(node)
            }
        }
        // Stable sort children by start_time.
        const sort = (n: InternalNode) => {
            n.children.sort((a, b) => a.span.start_time - b.span.start_time)
            for (const c of n.children) sort(c)
        }
        for (const r of roots) sort(r)
        return roots
    }

    *#walk(nodes: InternalNode[]): IterableIterator<InternalNode> {
        for (const n of nodes) {
            yield n
            yield* this.#walk(n.children)
        }
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd apps/dashboard && bun run test
```

Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/lib/trace apps/dashboard/package.json
git commit -m "feat(dashboard): TraceViewport state class with $state/$derived

Flattens span tree depth-first, computes pixel ranges relative to root
duration, supports expand/collapse + selection. ~120 LOC, vitest-covered
(4 unit tests). Per docs/reference/trace-span-viewer-ui/04 §State shape."
```

---

### Task 8: SpanRow component

**Files:**
- Create: `apps/dashboard/src/lib/components/trace-viewer/SpanRow.svelte`
- Create: `apps/dashboard/src/lib/components/trace-viewer/SpanColors.ts`

- [ ] **Step 1: Define color palette**

Create `apps/dashboard/src/lib/components/trace-viewer/SpanColors.ts`:

```ts
// Okabe-Ito 8-color palette — chosen for color-blind safety + perceptual
// distinguishability. See docs/reference/trace-span-viewer-ui/04 §Color encoding.
export const SPAN_COLORS: Record<string, string> = {
    llm:        '#0072B2',   // blue
    agent:      '#D55E00',   // vermillion
    chain:      '#009E73',   // bluish green
    tool:       '#F0E442',   // yellow
    retrieval:  '#56B4E9',   // sky blue
    embedding:  '#CC79A7',   // reddish purple
    workflow:   '#E69F00',   // orange
    custom:     '#999999',   // grey
}

export function colorFor(spanType?: string): string {
    if (!spanType) return SPAN_COLORS.custom
    const lower = spanType.toLowerCase()
    for (const key of Object.keys(SPAN_COLORS)) {
        if (lower.includes(key)) return SPAN_COLORS[key]
    }
    return SPAN_COLORS.custom
}
```

- [ ] **Step 2: Create SpanRow component**

Create `apps/dashboard/src/lib/components/trace-viewer/SpanRow.svelte`:

```svelte
<script lang="ts">
    import type { SpanRow } from '$lib/trace/viewport.svelte'
    import { colorFor } from './SpanColors'
    import { formatLatency } from '$lib/utils/format'

    interface Props {
        row: SpanRow
        selected: boolean
        onClick: (id: string) => void
        onToggle: (id: string) => void
    }

    let { row, selected, onClick, onToggle }: Props = $props()

    const INDENT_PX = 14
    const ROW_HEIGHT_PX = 28
</script>

<div
    class="span-row"
    class:selected
    style="height: {ROW_HEIGHT_PX}px"
    onclick={() => onClick(row.id)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(row.id) }}
    role="treeitem"
    aria-selected={selected}
    tabindex="0"
>
    <div class="label-col" style="padding-left: {row.depth * INDENT_PX + 4}px">
        {#if row.hasChildren}
            <button
                class="caret"
                onclick={(e) => { e.stopPropagation(); onToggle(row.id) }}
                aria-label="Toggle"
            >▸</button>
        {:else}
            <span class="caret-spacer"></span>
        {/if}
        <span class="span-name" title={row.name}>{row.name}</span>
        <span class="span-type">{row.span_type ?? ''}</span>
    </div>
    <div class="bar-col">
        <div
            class="span-bar"
            style:left="{row.xPx}px"
            style:width="{row.widthPx}px"
            style:background-color={colorFor(row.span_type)}
        ></div>
    </div>
    <div class="duration-col">{formatLatency(row.duration_ms)}</div>
</div>

<style>
    .span-row {
        display: grid;
        grid-template-columns: minmax(220px, 35%) 1fr 80px;
        align-items: center;
        cursor: pointer;
        border-bottom: 1px solid var(--row-border, rgba(0,0,0,0.05));
        font-size: 13px;
    }
    .span-row:hover { background: var(--row-hover, rgba(0,0,0,0.03)); }
    .span-row.selected { background: var(--row-selected, rgba(0, 120, 215, 0.12)); }

    .label-col { display: flex; align-items: center; gap: 6px; overflow: hidden; }
    .caret { background: none; border: 0; cursor: pointer; padding: 0 4px; color: var(--muted); }
    .caret-spacer { display: inline-block; width: 16px; }
    .span-name { font-family: var(--font-mono, ui-monospace, monospace); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .span-type { font-size: 11px; opacity: 0.6; }

    .bar-col { position: relative; height: 100%; }
    .span-bar { position: absolute; top: 8px; height: 12px; border-radius: 3px; }

    .duration-col { text-align: right; padding-right: 8px; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
</style>
```

- [ ] **Step 3: Manual visual check** (no automated test for visual component)

Skip until Task 10 wires the row into the waterfall — visual verification happens there.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/lib/components/trace-viewer/
git commit -m "feat(dashboard): SpanRow + Okabe-Ito color palette

ROW_HEIGHT_PX = 28, INDENT_PX = 14 (per Jaeger / Phoenix conventions
documented in docs/reference/trace-span-viewer-ui/02 + 04). Grid layout:
label | bar | duration. Caret toggles via prop, doesn't propagate to row click."
```

---

### Task 9: SpanWaterfall component (virtualized)

**Files:**
- Create: `apps/dashboard/src/lib/components/trace-viewer/SpanWaterfall.svelte`

- [ ] **Step 1: Implement virtualized scroll**

```svelte
<script lang="ts">
    import { TraceViewport, type SpanInput } from '$lib/trace/viewport.svelte'
    import SpanRow from './SpanRow.svelte'

    interface Props {
        spans: SpanInput[]
        onSelect?: (id: string) => void
    }

    let { spans, onSelect }: Props = $props()

    const ROW_HEIGHT_PX = 28
    const OVERSCAN = 8

    const viewport = new TraceViewport(spans)

    let scrollEl: HTMLDivElement
    let scrollTop = $state(0)
    let containerHeight = $state(600)
    let waterfallWidth = $state(0)

    $effect(() => {
        if (!scrollEl) return
        const ro = new ResizeObserver(entries => {
            for (const e of entries) {
                containerHeight = e.contentRect.height
                const barCol = e.contentRect.width * 0.65 - 80
                waterfallWidth = Math.max(200, barCol)
                viewport.setViewportWidth(waterfallWidth)
            }
        })
        ro.observe(scrollEl)
        return () => ro.disconnect()
    })

    const total = $derived(viewport.rows.length)
    const visibleStart = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN))
    const visibleEnd = $derived(Math.min(total, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT_PX) + OVERSCAN))
    const visibleRows = $derived(viewport.rows.slice(visibleStart, visibleEnd))
    const padTop = $derived(visibleStart * ROW_HEIGHT_PX)
    const padBottom = $derived((total - visibleEnd) * ROW_HEIGHT_PX)

    function handleSelect(id: string) {
        viewport.select(id)
        onSelect?.(id)
    }
</script>

<div
    bind:this={scrollEl}
    class="waterfall"
    onscroll={(e) => { scrollTop = (e.currentTarget as HTMLDivElement).scrollTop }}
>
    <div class="time-axis">
        <span class="axis-tick">0ms</span>
        <span class="axis-tick" style:left="50%">{Math.round(viewport.totalDuration / 2)}ms</span>
        <span class="axis-tick" style:right="80px">{Math.round(viewport.totalDuration)}ms</span>
    </div>
    <div class="row-list" style:padding-top="{padTop}px" style:padding-bottom="{padBottom}px">
        {#each visibleRows as row (row.id)}
            <SpanRow
                {row}
                selected={viewport.selectedId === row.id}
                onClick={handleSelect}
                onToggle={(id) => viewport.toggle(id)}
            />
        {/each}
    </div>
</div>

<style>
    .waterfall {
        height: 100%;
        overflow-y: auto;
        position: relative;
        font-family: var(--font-sans);
    }
    .time-axis {
        position: sticky;
        top: 0;
        height: 24px;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--row-border);
        z-index: 1;
    }
    .axis-tick {
        position: absolute;
        font-size: 11px;
        color: var(--muted);
        padding: 4px 6px;
    }
    .row-list { will-change: transform; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/lib/components/trace-viewer/SpanWaterfall.svelte
git commit -m "feat(dashboard): SpanWaterfall — virtualized DOM rows + sticky axis

Hand-rolled virtualization per docs/reference/trace-span-viewer-ui/04 —
~80 LOC, OVERSCAN=8, ROW_HEIGHT=28. ResizeObserver feeds viewport width
to the TraceViewport's pxPerMs math. Sticky time axis at top."
```

---

### Task 10: SpanDetailPanel component

**Files:**
- Create: `apps/dashboard/src/lib/components/trace-viewer/SpanDetailPanel.svelte`

- [ ] **Step 1: Build the panel**

```svelte
<script lang="ts">
    import { formatLatency } from '$lib/utils/format'

    interface Props {
        span: Record<string, unknown> | null
    }

    let { span }: Props = $props()

    let activeTab = $state<'attributes' | 'input' | 'output' | 'request' | 'response'>('attributes')

    function asJson(value: unknown): string {
        if (value == null) return ''
        if (typeof value === 'string') {
            try { return JSON.stringify(JSON.parse(value), null, 2) }
            catch { return value }
        }
        return JSON.stringify(value, null, 2)
    }
</script>

{#if span}
    <div class="detail-panel">
        <header>
            <div class="name">{span.span_name ?? span.name}</div>
            <div class="meta">
                <span>{span.span_type ?? '—'}</span>
                <span>·</span>
                <span>{formatLatency(span.duration_ms as number)}</span>
                {#if span.estimated_cost}
                    <span>·</span>
                    <span>${(span.estimated_cost as number).toFixed(4)}</span>
                {/if}
                {#if span.total_tokens}
                    <span>·</span>
                    <span>{span.total_tokens} tok</span>
                {/if}
            </div>
        </header>
        <nav class="tabs">
            {#each ['attributes', 'input', 'output', 'request', 'response'] as tab}
                <button
                    class:active={activeTab === tab}
                    onclick={() => activeTab = tab as typeof activeTab}
                >{tab}</button>
            {/each}
        </nav>
        <pre class="body">{asJson(span[activeTab])}</pre>
    </div>
{:else}
    <div class="detail-panel empty">Select a span to see its details.</div>
{/if}

<style>
    .detail-panel {
        display: flex; flex-direction: column; height: 100%;
        border-left: 1px solid var(--row-border);
        font-family: var(--font-sans);
    }
    .detail-panel.empty {
        align-items: center; justify-content: center;
        color: var(--muted); font-size: 13px;
    }
    header { padding: 12px 16px; border-bottom: 1px solid var(--row-border); }
    .name { font-family: var(--font-mono); font-size: 14px; font-weight: 600; }
    .meta { font-size: 12px; color: var(--muted); margin-top: 4px; display: flex; gap: 6px; }
    .tabs { display: flex; border-bottom: 1px solid var(--row-border); }
    .tabs button {
        background: none; border: 0; padding: 8px 12px; cursor: pointer;
        font-size: 12px; color: var(--muted);
        border-bottom: 2px solid transparent;
    }
    .tabs button.active { color: var(--text); border-bottom-color: var(--accent, #0072B2); }
    .body {
        flex: 1; overflow: auto; padding: 12px 16px;
        font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap;
    }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/lib/components/trace-viewer/SpanDetailPanel.svelte
git commit -m "feat(dashboard): SpanDetailPanel with tabbed attribute/IO views"
```

---

### Task 11: Replace SpanTree with SpanWaterfall in TraceDetail

**Files:**
- Modify: `apps/dashboard/src/lib/components/traces/TraceDetail.svelte`
- Delete: `apps/dashboard/src/lib/components/traces/SpanTree.svelte`

- [ ] **Step 1: Wire SpanWaterfall + SpanDetailPanel into TraceDetail**

Rewrite `apps/dashboard/src/lib/components/traces/TraceDetail.svelte` (replacing the current 66-line file):

```svelte
<script lang="ts">
    import SpanWaterfall from '$lib/components/trace-viewer/SpanWaterfall.svelte'
    import SpanDetailPanel from '$lib/components/trace-viewer/SpanDetailPanel.svelte'
    import type { Span } from '$lib/stores/traces.svelte'

    interface Props {
        spans: Span[]
    }

    let { spans }: Props = $props()

    let selectedId = $state<string | null>(null)
    const selectedSpan = $derived(spans.find(s => s.id === selectedId) ?? null)

    // Adapt store-shape spans to viewport input shape
    const viewportSpans = $derived(spans.map(s => ({
        id: s.id,
        parent_id: s.parent_id,
        name: s.span_name ?? s.name ?? s.id,
        start_time: s.start_time ?? s.timestamp,
        duration_ms: s.duration_ms ?? 0,
        span_type: s.span_type,
        ...s
    })))
</script>

<div class="trace-detail">
    <div class="waterfall-pane">
        <SpanWaterfall spans={viewportSpans} onSelect={(id) => selectedId = id} />
    </div>
    <div class="detail-pane">
        <SpanDetailPanel span={selectedSpan} />
    </div>
</div>

<style>
    .trace-detail {
        display: grid;
        grid-template-columns: 1fr 380px;
        height: 100%;
        min-height: 400px;
    }
    @media (max-width: 900px) {
        .trace-detail { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
    }
</style>
```

- [ ] **Step 2: Delete SpanTree.svelte**

```bash
cd /Users/helge/code/llmflow
git rm apps/dashboard/src/lib/components/traces/SpanTree.svelte
```

- [ ] **Step 3: Build to confirm no compile errors**

```bash
cd apps/dashboard && bun run build 2>&1 | tail -15
```

Expected: `✓ built in ...` with no errors. Warnings about unused `Span` fields are OK.

- [ ] **Step 4: Visual smoke test**

```bash
cd /Users/helge/code/llmflow
bun run dev:dashboard &
DASHBOARD_PID=$!
sleep 3
# In browser: open http://localhost:5173, navigate to Traces tab, click a trace
# Verify: waterfall renders, clicking a span shows the detail panel
kill $DASHBOARD_PID 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/lib/components/traces/TraceDetail.svelte
git commit -m "feat(dashboard): TraceDetail uses SpanWaterfall + SpanDetailPanel

Replaces SpanTree.svelte (deleted). 2-column grid: waterfall (1fr) +
detail (380px), collapses to stacked on viewports < 900px."
```

---

### Task 12: Sessions frontend store

**Files:**
- Create: `apps/dashboard/src/lib/stores/sessions.svelte.ts`

- [ ] **Step 1: Implement the store**

```ts
import { api } from '$lib/api/client'

export interface SessionSummary {
    session_id: string
    first_seen: number
    last_seen: number
    trace_count: number
    total_cost: number
    total_tokens: number
    agent_name: string | null
    service_name: string | null
}

export interface SessionDetail {
    session_id: string
    traces: Array<{
        trace_id: string
        started_at: number
        ended_at: number
        cost: number
        tokens: number
        span_count: number
        has_error: number
    }>
    summary: { cost: number; tokens: number; spans: number; errors: number }
}

export const sessionsState = $state({
    list: [] as SessionSummary[],
    total: 0,
    selected: null as SessionDetail | null,
    loading: false,
    error: null as string | null
})

export async function loadSessions(limit = 50, offset = 0) {
    sessionsState.loading = true
    try {
        const r = await api(`/api/sessions?limit=${limit}&offset=${offset}`)
        sessionsState.list = r.sessions
        sessionsState.total = r.total
        sessionsState.error = null
    } catch (e) {
        sessionsState.error = (e as Error).message
    } finally {
        sessionsState.loading = false
    }
}

export async function loadSession(id: string) {
    sessionsState.loading = true
    try {
        sessionsState.selected = await api(`/api/sessions/${encodeURIComponent(id)}`)
        sessionsState.error = null
    } catch (e) {
        sessionsState.error = (e as Error).message
    } finally {
        sessionsState.loading = false
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/lib/stores/sessions.svelte.ts
git commit -m "feat(dashboard): sessions store backed by /api/sessions"
```

---

### Task 13: SessionsTab + SessionList + SessionDetail

**Files:**
- Create: `apps/dashboard/src/lib/components/sessions/SessionsTab.svelte`
- Create: `apps/dashboard/src/lib/components/sessions/SessionList.svelte`
- Create: `apps/dashboard/src/lib/components/sessions/SessionDetail.svelte`
- Modify: `apps/dashboard/src/lib/stores/tabs.svelte.ts`
- Modify: `apps/dashboard/src/App.svelte`

- [ ] **Step 1: SessionList**

Create `apps/dashboard/src/lib/components/sessions/SessionList.svelte`:

```svelte
<script lang="ts">
    import { sessionsState, loadSession } from '$lib/stores/sessions.svelte'

    interface Props {
        onSelect: (id: string) => void
    }

    let { onSelect }: Props = $props()

    function fmtDate(ms: number): string {
        return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
    }
    function fmtAgo(ms: number): string {
        const diff = Date.now() - ms
        if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
        return `${Math.floor(diff / 86_400_000)}d ago`
    }
</script>

<table class="sessions-table">
    <thead>
        <tr>
            <th>Session</th>
            <th>Agent / Service</th>
            <th>Traces</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Last seen</th>
        </tr>
    </thead>
    <tbody>
        {#each sessionsState.list as s (s.session_id)}
            <tr onclick={() => { loadSession(s.session_id); onSelect(s.session_id) }}>
                <td class="mono">{s.session_id}</td>
                <td>{s.agent_name ?? s.service_name ?? '—'}</td>
                <td>{s.trace_count}</td>
                <td>{s.total_tokens.toLocaleString()}</td>
                <td>${s.total_cost.toFixed(4)}</td>
                <td title={fmtDate(s.last_seen)}>{fmtAgo(s.last_seen)}</td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    .sessions-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--row-border); }
    th { font-weight: 600; color: var(--muted); }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--row-hover); }
    .mono { font-family: var(--font-mono); font-size: 12px; }
</style>
```

- [ ] **Step 2: SessionDetail**

Create `apps/dashboard/src/lib/components/sessions/SessionDetail.svelte`:

```svelte
<script lang="ts">
    import { sessionsState } from '$lib/stores/sessions.svelte'

    interface Props {
        onOpenTrace: (traceId: string) => void
    }

    let { onOpenTrace }: Props = $props()

    function fmt(ms: number) { return new Date(ms).toLocaleTimeString() }
</script>

{#if sessionsState.selected}
    <div class="session-detail">
        <header>
            <h2>Session <span class="mono">{sessionsState.selected.session_id}</span></h2>
            <div class="summary">
                {sessionsState.selected.traces.length} traces ·
                {sessionsState.selected.summary.spans} spans ·
                {sessionsState.selected.summary.tokens.toLocaleString()} tokens ·
                ${sessionsState.selected.summary.cost.toFixed(4)}
                {#if sessionsState.selected.summary.errors > 0}
                    · <span class="error">{sessionsState.selected.summary.errors} errors</span>
                {/if}
            </div>
        </header>
        <ol class="trace-list">
            {#each sessionsState.selected.traces as t (t.trace_id)}
                <li onclick={() => onOpenTrace(t.trace_id)}>
                    <span class="time">{fmt(t.started_at)}</span>
                    <span class="trace-id mono">{t.trace_id.slice(0, 8)}…</span>
                    <span class="spans">{t.span_count} spans</span>
                    <span class="cost">${t.cost.toFixed(4)}</span>
                    {#if t.has_error} <span class="err">error</span>{/if}
                </li>
            {/each}
        </ol>
    </div>
{:else}
    <div class="empty">Loading…</div>
{/if}

<style>
    .session-detail { padding: 16px; font-family: var(--font-sans); }
    header h2 { margin: 0 0 8px; font-size: 16px; }
    .summary { color: var(--muted); font-size: 13px; }
    .error { color: var(--err, #d55e00); }
    .trace-list { list-style: none; padding: 0; margin-top: 16px; }
    .trace-list li {
        display: grid; grid-template-columns: 80px 100px 1fr 80px auto;
        gap: 12px; padding: 8px; cursor: pointer; border-bottom: 1px solid var(--row-border);
    }
    .trace-list li:hover { background: var(--row-hover); }
    .mono { font-family: var(--font-mono); font-size: 12px; }
    .err { color: var(--err, #d55e00); }
    .empty { padding: 16px; color: var(--muted); }
</style>
```

- [ ] **Step 3: SessionsTab (orchestrates list ↔ detail)**

Create `apps/dashboard/src/lib/components/sessions/SessionsTab.svelte`:

```svelte
<script lang="ts">
    import { onMount } from 'svelte'
    import { sessionsState, loadSessions } from '$lib/stores/sessions.svelte'
    import { setTab } from '$lib/stores/tabs.svelte'
    import SessionList from './SessionList.svelte'
    import SessionDetail from './SessionDetail.svelte'

    let view = $state<'list' | 'detail'>('list')

    onMount(() => loadSessions())

    function openSession(_id: string) {
        view = 'detail'
    }

    function openTrace(traceId: string) {
        // Cross-tab navigation: jump to Traces tab with the selected trace
        setTab('traces')
        window.location.hash = `#traces?trace=${encodeURIComponent(traceId)}`
    }
</script>

<div class="sessions-tab">
    {#if view === 'list'}
        <SessionList onSelect={openSession} />
    {:else}
        <button class="back" onclick={() => view = 'list'}>← back to sessions</button>
        <SessionDetail onOpenTrace={openTrace} />
    {/if}
</div>

<style>
    .sessions-tab { height: 100%; overflow: auto; }
    .back {
        background: none; border: 0; padding: 8px 16px; cursor: pointer;
        font-size: 12px; color: var(--muted);
    }
</style>
```

- [ ] **Step 4: Register the tab**

Modify `apps/dashboard/src/lib/stores/tabs.svelte.ts` — find the `validTabs` array and add `'sessions'`:

```ts
export const validTabs = ['timeline', 'traces', 'sessions', 'logs', 'metrics', 'models', 'analytics'] as const
```

- [ ] **Step 5: Mount the tab in App.svelte**

Modify `apps/dashboard/src/App.svelte` — at the top, add the import next to the others:

```svelte
import SessionsTab from '$lib/components/sessions/SessionsTab.svelte'
```

And in the main render block, add a clause for `'sessions'`:

```svelte
{:else if tabState.current === 'sessions'}
    <SessionsTab />
```

- [ ] **Step 6: Build + visual smoke**

```bash
cd apps/dashboard && bun run build 2>&1 | tail -5
```

Expected: build succeeds. Manually verify the new tab appears.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/lib/components/sessions apps/dashboard/src/App.svelte apps/dashboard/src/lib/stores/tabs.svelte.ts
git commit -m "feat(dashboard): Sessions tab with list and detail views

SessionList: paginated table of sessions ordered by last_seen DESC.
SessionDetail: traces in a session with click-through into the existing
Traces tab. Tab registered in tabs.svelte.ts."
```

---

### Task 14: Glue emits session.id per CLI session

**Files:**
- Modify: `../glue/packages/glue_harness/lib/src/observability/otlp_http_trace_sink.dart`

- [ ] **Step 1: Locate the resource-attribute builder**

```bash
cd /Users/helge/code/glue
grep -n "resource\|resourceAttributes\|service.name" packages/glue_harness/lib/src/observability/otlp_http_trace_sink.dart | head -10
```

- [ ] **Step 2: Add session.id to resource attributes**

In the OTLP sink, generate one ULID/UUID per process and include it as `session.id`:

```dart
// At top of the class
static final String _sessionId = _generateSessionId();

static String _generateSessionId() {
  final ts = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
  final rand = (DateTime.now().microsecondsSinceEpoch & 0xFFFFFF).toRadixString(36);
  return 'glue-$ts-$rand';
}
```

Then add it to the resource-attribute construction (where `service.name` etc. live):

```dart
{'key': 'session.id', 'value': {'stringValue': _sessionId}},
```

(Use the surrounding code's existing attribute-builder style. The exact location depends on how the existing builder is structured — see grep output from step 1.)

- [ ] **Step 3: Verify end-to-end**

```bash
# In one terminal: start llmflow
cd /Users/helge/code/llmflow && bun run dev

# In another: run glue with otlp endpoint configured (already set in ~/.glue/config.yaml from earlier work)
cd /Users/helge/code/glue
just build   # rebuild the binary with the new attribute
./glue "what is the time?"

# In a third: query the dashboard
curl -sS http://127.0.0.1:3000/api/sessions | jq '.sessions[0]'
```

Expected: at least one session with `agent_name: "glue"` (or the resolved name) and a non-null `session_id`.

- [ ] **Step 4: Commit (in the glue repo)**

```bash
cd /Users/helge/code/glue
git add packages/glue_harness/lib/src/observability/otlp_http_trace_sink.dart
git commit -m "feat(observability): emit session.id resource attribute per CLI session

Lets llmflow group multiple traces from a single 'glue' invocation
under one session in its dashboard. Session ID format: glue-<ts>-<rand>."
```

---

### Task 15: End-to-end test

**Files:**
- Create: `apps/server/test/sessions-e2e.js`

- [ ] **Step 1: Write the test**

```js
const assert = require('node:assert');

const BASE = process.env.LLMFLOW_URL || 'http://127.0.0.1:3000';

async function postSpan(sessionId, name) {
    const span = {
        resourceSpans: [{
            resource: { attributes: [] },
            scopeSpans: [{
                spans: [{
                    traceId: crypto.randomUUID().replace(/-/g, ''),
                    spanId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
                    name,
                    startTimeUnixNano: String(Date.now() * 1_000_000),
                    endTimeUnixNano: String((Date.now() + 100) * 1_000_000),
                    attributes: [{ key: 'session.id', value: { stringValue: sessionId } }],
                    status: { code: 1 }
                }]
            }]
        }]
    };
    const r = await fetch(`${BASE}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(span)
    });
    assert.strictEqual(r.status, 200);
}

async function run() {
    const sessionId = 'e2e-' + Math.random().toString(36).slice(2);

    // Ingest three spans (three separate traces) tagged with the same session
    await postSpan(sessionId, 'turn-1');
    await postSpan(sessionId, 'turn-2');
    await postSpan(sessionId, 'turn-3');

    // Sessions list should include it
    const list = await (await fetch(`${BASE}/api/sessions?limit=100`)).json();
    const found = list.sessions.find(s => s.session_id === sessionId);
    assert.ok(found, 'session not found in /api/sessions');
    assert.strictEqual(found.trace_count, 3, `expected 3 traces, got ${found.trace_count}`);

    // Session detail should return three traces
    const detail = await (await fetch(`${BASE}/api/sessions/${sessionId}`)).json();
    assert.strictEqual(detail.traces.length, 3);

    console.log('✓ session correlation e2e passed');
}

run().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run it (via the existing run-tests harness)**

```bash
cd apps/server
DATA_DIR=$(mktemp -d) bun run test/run-tests.js sessions-e2e.js
```

Expected: `✓ session correlation e2e passed`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/test/sessions-e2e.js
git commit -m "test(e2e): session correlation across 3 OTLP traces"
```

---

### Task 16: Update llms.txt + AGENTS.md to document the session attribute

**Files:**
- Modify: `website/llms.txt` — Add a section under "Custom Tags" about session ID
- Modify: `AGENTS.md` — Mention session_id in the data-model summary

- [ ] **Step 1: Update llms.txt**

Find the "Custom Tags" section in `website/llms.txt` and add right after it:

```markdown
### Custom Sessions

Group multiple traces under a single session by setting `session.id` (OpenInference)
or `gen_ai.conversation.id` (OTel) on your spans. llmflow recognizes a priority chain:

1. `session.id` (OpenInference) — recommended
2. `langsmith.trace.session_id`
3. `traceloop.association.properties.session_id`
4. `ai.telemetry.metadata.sessionId` (Vercel AI SDK)
5. `service.instance.id` resource attribute (process-level fallback)

A session shows up in the dashboard's Sessions tab with aggregate cost/token/trace counts.
Query `GET /api/sessions/:id` for programmatic access.
```

- [ ] **Step 2: Update AGENTS.md data-model section**

Add this bullet to the architecture section:

```markdown
- **Sessions**: `traces.session_id` (nullable) groups multiple traces. Filled by OTLP
  ingest from `session.id`, `langsmith.trace.session_id`, `traceloop.association.properties.session_id`,
  `ai.telemetry.metadata.sessionId`, or `service.instance.id`. `traces.conversation_id`
  holds `gen_ai.conversation.id` for chat threads. See `packages/otlp/src/traces.js`.
```

- [ ] **Step 3: Commit**

```bash
git add website/llms.txt AGENTS.md
git commit -m "docs: document session_id ingestion + Sessions tab in llms.txt and AGENTS.md"
```

---

### Task 17: Verify full PR, push, open

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/helge/code/llmflow
bun run --filter @llmflow/server test
```

Expected: at least 55 passing (the baseline) + the 6 new unit tests + the 1 new e2e test.

- [ ] **Step 2: Typecheck**

```bash
bunx tsc --noEmit -p apps/server/tsconfig.json
cd apps/dashboard && bunx tsc --noEmit
```

Expected: only the 2 pre-existing `db.ts` SQLQueryBindings errors. No new errors.

- [ ] **Step 3: Build dashboard**

```bash
cd apps/dashboard && bun run build
```

Expected: ✓ built without warnings about the new components.

- [ ] **Step 4: Smoke**

```bash
cd /Users/helge/code/llmflow
DATA_DIR=$(mktemp -d) bun run dev &
SERVER_PID=$!
sleep 2
curl -sS http://127.0.0.1:3000/api/sessions
kill $SERVER_PID 2>/dev/null
```

Expected: `{"sessions":[],"total":0}` on an empty DB.

- [ ] **Step 5: Push and open PR**

The branch should already exist from Task 1 — if not, create it before Task 1
runs (`git checkout -b span-viewer-sessions`).

```bash
cd /Users/helge/code/llmflow
git push -u origin span-viewer-sessions
gh pr create --title "Span viewer + session correlation" \
  --body-file - <<'EOF'
## Summary

[summary will be written by the engineer who runs this plan, summarizing
each of the 17 tasks above and the verification results]

## Test plan

- [x] Sessions e2e test passes
- [x] Six otlp-session-extraction unit tests pass
- [x] Four viewport.svelte unit tests pass (vitest)
- [x] 55-baseline server tests still pass
- [x] Dashboard builds without warnings
- [x] Glue end-to-end: `glue "test"` → session appears in dashboard
EOF
```

- [ ] **Step 6: Self-review**

Open the PR diff and re-read every commit message. Check that each commit body
explains *why*, not just *what*. Fix any commits with sparse messages via
`git commit --amend` before the PR has been reviewed.

---

## Open questions for the engineer

1. **`service.instance.id` as session fallback** — this is included as priority 5 in `extractSessionId`. It means a long-lived process (daemon, dev server) becomes one session. Some teams will want this; others find it confusing. If feedback during execution suggests it's wrong, drop it from the chain and document the change.

2. **Conversation rendering** — this plan adds `conversation_id` columns but does NOT build a "render N traces in a conversation as a chat thread" view. That's a follow-up. The Sessions tab today shows traces as a flat list; a richer "Threads" view (per `01-llm-tools-survey.md` § LangSmith) is the next step.

3. **Mini-map** — Doc 04 recommends a Canvas mini-map of the full trace for orientation when scrolled. Not in this plan — at 5k spans the virtualized DOM list is fast enough without one. Add only after we see a real >2k-span trace in the wild.

4. **Cost-based collapse** — Langfuse's heuristic of auto-collapsing spans below a cost threshold is mentioned in `01-llm-tools-survey.md` as worth stealing. Defer until we have a real complaint about long traces being hard to scan.

5. **Glue session ID format** — current plan uses `glue-<ts>-<rand>`. ULID would be cleaner but adds a dep. Stick with the homegrown format unless the engineer hits a real sorting/uniqueness issue.
