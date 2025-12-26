# Bun Migration Plan for LLMFlow

> Planning document for migrating from Node.js + Express to Bun native APIs

## Executive Summary

**Recommendation:** Migrate to **Bun.serve()** + **bun:sqlite** + native WebSocket

**Effort:** L (4-6 days for full backend migration)

**Benefits:**
- 2.5x faster HTTP server than Node.js
- 3-6x faster SQLite than better-sqlite3
- 7x faster WebSockets than ws library
- Single runtime: no more Node vs npm vs npx complexity
- Unified fullstack with Svelte bundling built-in
- Simpler deployment: single binary possible

**Risks:**
- Bun-specific APIs (lock-in)
- Less community examples for complex patterns
- Must re-test all proxy/streaming behaviors

---

## Current State

| Component | Current | Lines | Bun Replacement |
|-----------|---------|-------|-----------------|
| HTTP Server | Express | 1,263 | Bun.serve() |
| Database | better-sqlite3 | 943 | bun:sqlite |
| WebSocket | ws | ~100 | Bun native WS |
| UUID | uuid | - | crypto.randomUUID() |
| HTTP Client | http/https | ~200 | fetch() |
| **Total** | | **~4,000** | |

### Dependencies to Remove

```json
{
  "dependencies": {
    "express": "^4.18.0",      // → Bun.serve()
    "better-sqlite3": "^11.0.0", // → bun:sqlite
    "ws": "^8.18.3",           // → Bun websocket
    "uuid": "^9.0.0"           // → crypto.randomUUID()
  }
}
```

---

## Target Architecture

```
src/
├── server.ts              # Main Bun.serve() entry
├── db.ts                  # bun:sqlite database
├── pricing.ts             # Cost calculation
├── logger.ts              # Logging utilities
│
├── routes/
│   ├── proxy.ts           # LLM proxy handler
│   ├── passthrough.ts     # Passthrough handler
│   ├── api.ts             # Dashboard API routes
│   └── otlp.ts            # OTLP ingestion
│
├── providers/
│   ├── index.ts           # Provider registry
│   ├── base.ts            # Base provider class
│   ├── openai.ts
│   ├── anthropic.ts
│   └── ...
│
├── websocket.ts           # WebSocket pub/sub handler
│
└── frontend/              # Svelte 5 app (see SVELTE_MIGRATION_PLAN.md)
    ├── src/
    └── ...
```

---

## API Mapping

### HTTP Server: Express → Bun.serve()

**Before (Express):**
```javascript
const express = require('express');
const app = express();

app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/traces', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const traces = db.getTraces({ limit });
  res.json(traces);
});

app.listen(3000);
```

**After (Bun):**
```typescript
Bun.serve({
  port: 3000,
  
  async fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === '/health' && req.method === 'GET') {
      return Response.json({ status: 'ok' });
    }
    
    if (url.pathname === '/api/traces' && req.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || '50');
      const traces = db.getTraces({ limit });
      return Response.json(traces);
    }
    
    return new Response('Not Found', { status: 404 });
  }
});
```

### Database: better-sqlite3 → bun:sqlite

**Before:**
```javascript
const Database = require('better-sqlite3');
const db = new Database('data.db');

const stmt = db.prepare('SELECT * FROM traces WHERE id = ?');
const trace = stmt.get(id);

const insertStmt = db.prepare('INSERT INTO traces (...) VALUES (...)');
insertStmt.run({ id, timestamp, ... });
```

**After:**
```typescript
import { Database } from 'bun:sqlite';
const db = new Database('data.db', { create: true });

// .query() instead of .prepare()
const stmt = db.query('SELECT * FROM traces WHERE id = ?');
const trace = stmt.get(id);

// Same .run() API
const insertStmt = db.query('INSERT INTO traces (...) VALUES (...)');
insertStmt.run({ $id: id, $timestamp: timestamp, ... });
```

**Key differences:**
- Use `db.query()` instead of `db.prepare()`
- Named params need `$` prefix: `$id` not `id`
- Use `{ create: true }` to auto-create DB file
- `.run()` returns `{ lastInsertRowid, changes }`

### WebSocket: ws → Bun native

**Before (ws):**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello' }));
  
  ws.on('message', (data) => {
    console.log('received:', data);
  });
});

// Broadcast to all clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
```

**After (Bun):**
```typescript
const server = Bun.serve({
  port: 3000,
  
  websocket: {
    open(ws) {
      ws.subscribe('updates');
      ws.send(JSON.stringify({ type: 'hello' }));
    },
    
    message(ws, message) {
      console.log('received:', message);
    },
    
    close(ws) {
      // Auto-unsubscribed
    }
  },
  
  fetch(req, server) {
    if (new URL(req.url).pathname === '/ws') {
      if (server.upgrade(req)) return;
      return new Response('Upgrade failed', { status: 400 });
    }
    // ... other routes
  }
});

// Broadcast using pub/sub
function broadcast(data: any) {
  server.publish('updates', JSON.stringify(data));
}
```

**Key differences:**
- WebSocket config is part of `Bun.serve()`
- Use `server.upgrade(req)` for handshake
- Built-in pub/sub with `subscribe/publish`
- No manual client iteration needed

### HTTP Proxy: http.request → fetch

**Before:**
```javascript
const https = require('https');

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: { ... }
};

const upstreamReq = https.request(options, (upstreamRes) => {
  let body = '';
  upstreamRes.on('data', chunk => body += chunk);
  upstreamRes.on('end', () => {
    const data = JSON.parse(body);
    res.json(data);
  });
});

upstreamReq.write(JSON.stringify(requestBody));
upstreamReq.end();
```

**After:**
```typescript
const upstreamRes = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify(requestBody)
});

// Non-streaming
const data = await upstreamRes.json();
return Response.json(data);

// Streaming - just pass through the body
return new Response(upstreamRes.body, {
  status: upstreamRes.status,
  headers: upstreamRes.headers
});
```

### Streaming with Logging

**For streaming + logging (need to read body twice):**
```typescript
const upstreamRes = await fetch(url, options);

// Tee the stream: one for client, one for logging
const [clientBody, logBody] = upstreamRes.body!.tee();

// Fire-and-forget logging
(async () => {
  const text = await new Response(logBody).text();
  const usage = parseSSEForUsage(text);
  await logInteraction(traceId, usage, ...);
})();

// Return streaming response to client
return new Response(clientBody, {
  status: upstreamRes.status,
  headers: upstreamRes.headers
});
```

---

## Migration Strategy

### Phase 0: Run Under Bun (No Changes)

Test that existing code works with Bun's Node compatibility.

```bash
# Instead of node server.js
bun run server.js
```

Fix any compatibility issues (should be minimal).

**Deliverable:** Existing app runs on Bun runtime
**Effort:** S (2 hours)

---

### Phase 1: Migrate Database to bun:sqlite

Create `src/db.ts` using bun:sqlite with same public API.

```typescript
// src/db.ts
import { Database } from 'bun:sqlite';

const db = new Database(DB_PATH, { create: true });

// Same function signatures as db.js
export function insertTrace(trace: Trace) { ... }
export function getTraces(options: GetTracesOptions) { ... }
export function getTraceById(id: string) { ... }
// ... all other exports
```

**Deliverable:** All database operations use bun:sqlite
**Effort:** M (4 hours)

---

### Phase 2: Migrate HTTP Server

Replace Express with Bun.serve() for dashboard server first (simpler).

```typescript
// src/server.ts
import dashboard from './index.html';
import * as db from './db';
import { apiRoutes } from './routes/api';
import { wsHandler } from './websocket';

const DASHBOARD_PORT = Number(Bun.env.DASHBOARD_PORT || 3000);
const PROXY_PORT = Number(Bun.env.PROXY_PORT || 8080);

// Dashboard server
export const dashboardServer = Bun.serve({
  port: DASHBOARD_PORT,
  
  routes: {
    '/': dashboard, // Svelte app via HTML import
  },
  
  websocket: wsHandler,
  
  async fetch(req, server) {
    const url = new URL(req.url);
    
    // WebSocket upgrade
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return;
      return new Response('Upgrade failed', { status: 400 });
    }
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      return apiRoutes(req);
    }
    
    // OTLP ingestion
    if (url.pathname.startsWith('/v1/')) {
      return otlpRoutes(req);
    }
    
    return new Response('Not Found', { status: 404 });
  }
});

// Proxy server (separate port)
export const proxyServer = Bun.serve({
  port: PROXY_PORT,
  
  async fetch(req, server) {
    return proxyHandler(req, server);
  }
});

console.log(`Dashboard: http://localhost:${DASHBOARD_PORT}`);
console.log(`Proxy: http://localhost:${PROXY_PORT}`);
```

**Deliverable:** Both servers running on Bun.serve()
**Effort:** L (8 hours)

---

### Phase 3: Migrate Proxy Handler

Convert LLM proxy from http/https to fetch.

```typescript
// src/routes/proxy.ts
export async function proxyHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const body = req.method !== 'GET' ? await req.json() : undefined;
  
  const { provider, cleanPath } = registry.resolve(url.pathname, req.headers);
  const target = provider.getTarget(cleanPath);
  const headers = provider.transformRequestHeaders(req.headers);
  const transformedBody = provider.transformRequestBody(body);
  
  const upstreamUrl = `https://${target.hostname}${target.path}`;
  
  const upstreamRes = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body: transformedBody ? JSON.stringify(transformedBody) : undefined
  });
  
  if (body?.stream) {
    // Streaming response
    const [clientBody, logBody] = upstreamRes.body!.tee();
    logStreamAsync(logBody, provider, body);
    return new Response(clientBody, {
      status: upstreamRes.status,
      headers: upstreamRes.headers
    });
  }
  
  // Non-streaming
  const data = await upstreamRes.json();
  const normalized = provider.normalizeResponse(data);
  logInteraction(normalized);
  return Response.json(normalized.data);
}
```

**Deliverable:** All LLM providers working via fetch
**Effort:** M (6 hours)

---

### Phase 4: Migrate WebSocket

Replace ws library with Bun native WebSocket + pub/sub.

```typescript
// src/websocket.ts
export const wsHandler = {
  open(ws: ServerWebSocket) {
    ws.subscribe('traces');
    ws.subscribe('logs');
    ws.subscribe('metrics');
    ws.subscribe('stats');
    ws.send(JSON.stringify({ type: 'hello', time: Date.now() }));
  },
  
  message(ws: ServerWebSocket, message: string) {
    // Handle client messages if needed
  },
  
  close(ws: ServerWebSocket) {
    // Bun auto-unsubscribes
  }
};

// Hook into DB for real-time updates
db.setInsertTraceHook((trace) => {
  dashboardServer.publish('traces', JSON.stringify({
    type: 'new_trace',
    payload: trace
  }));
});

db.setInsertLogHook((log) => {
  dashboardServer.publish('logs', JSON.stringify({
    type: 'new_log',
    payload: log
  }));
});
```

**Deliverable:** Real-time updates working via Bun pub/sub
**Effort:** S (3 hours)

---

### Phase 5: Integrate Svelte Frontend

Use Bun's HTML imports for fullstack bundling.

```typescript
// src/server.ts
import dashboard from './frontend/index.html';

export const dashboardServer = Bun.serve({
  port: 3000,
  development: Bun.env.NODE_ENV !== 'production',
  
  routes: {
    '/': dashboard,
    '/dashboard': dashboard,
  },
  
  // ... rest of config
});
```

**Deliverable:** Svelte app bundled and served by Bun
**Effort:** M (4 hours, assuming Svelte migration is done)

---

### Phase 6: Cleanup

1. Remove old files: `server.js`, `db.js` (keep as reference)
2. Update `package.json`:
   ```json
   {
     "scripts": {
       "start": "bun run src/server.ts",
       "dev": "bun --hot src/server.ts",
       "build": "bun build src/server.ts --target=bun --outdir=dist"
     }
   }
   ```
3. Remove unused dependencies
4. Update Dockerfile for Bun
5. Update documentation

**Deliverable:** Clean Bun-only codebase
**Effort:** S (2 hours)

---

## Timeline Summary

| Phase | Description | Effort | Duration |
|-------|-------------|--------|----------|
| 0 | Run under Bun | S | 2h |
| 1 | Database (bun:sqlite) | M | 4h |
| 2 | HTTP Server (Bun.serve) | L | 8h |
| 3 | Proxy Handler (fetch) | M | 6h |
| 4 | WebSocket (native) | S | 3h |
| 5 | Svelte integration | M | 4h |
| 6 | Cleanup | S | 2h |
| **Total** | | | **~29 hours (4-5 days)** |

---

## Combined Migration Order

For **both** Svelte frontend and Bun backend:

### Week 1: Backend Foundation
1. Phase 0: Run existing code on Bun (verify compatibility)
2. Phase 1: Migrate to bun:sqlite
3. Phase 2: Migrate dashboard server to Bun.serve()

### Week 2: Backend Completion + Frontend Start
4. Phase 3: Migrate proxy handler to fetch
5. Phase 4: Migrate WebSocket to Bun native
6. Svelte Phase 0-1: Setup Vite + scaffold

### Week 3: Frontend Migration
7. Svelte Phase 2-4: Migrate Logs, Metrics, Traces tabs
8. Svelte Phase 5-6: Migrate Timeline, Models, Analytics

### Week 4: Integration + Polish
9. Phase 5: Integrate Svelte with Bun HTML imports
10. Phase 6: Cleanup and testing
11. Update Docker, docs, release

**Total combined effort:** ~60 hours (~2 weeks focused work)

---

## Dockerfile for Bun

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src ./src
COPY bunfig.toml ./

# Build (if using ahead-of-time bundling)
RUN bun build src/server.ts --target=bun --outdir=dist

# Runtime
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PROXY_PORT=8080
ENV DASHBOARD_PORT=3000

EXPOSE 8080 3000

CMD ["bun", "run", "dist/server.js"]
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking streaming | Test each provider's streaming with real API calls |
| bun:sqlite differences | Run parallel queries, compare results |
| WebSocket behavior | Test reconnection, pub/sub with multiple clients |
| Bun version issues | Pin Bun version in Dockerfile and CI |
| Rollback needed | Keep old server.js until fully validated |

---

## Testing Checklist

- [ ] All providers work (OpenAI, Anthropic, Gemini, Ollama, Cohere, Azure)
- [ ] Streaming responses work correctly
- [ ] Passthrough mode preserves native formats
- [ ] Token counting accurate for streaming
- [ ] WebSocket real-time updates work
- [ ] Dashboard API filtering works
- [ ] OTLP ingestion works
- [ ] CSV/JSON/JSONL export works
- [ ] Keyboard shortcuts work (frontend)
- [ ] Docker build and run works
- [ ] npx distribution works

---

_Created: 2025-12-26_
