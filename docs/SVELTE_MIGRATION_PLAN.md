# Svelte Migration Plan for LLMFlow Dashboard

> Planning document for migrating the vanilla JS frontend to Svelte 5

## Executive Summary

**Recommendation:** Migrate to **Svelte 5 + Vite** (no SvelteKit)

**Effort:** M-L (3-5 days for full migration)

**Benefits:**
- Better code organization as app grows
- Reactive state management with Svelte 5 runes
- Smaller bundle size (Svelte compiles away the framework)
- Type safety with TypeScript
- Easier maintenance and testing

**Costs:**
- Introduces build step (acceptable for npx/Docker distribution)
- Learning curve for contributors (but Svelte is close to vanilla JS)

---

## Current State

| File | Lines | Purpose |
|------|-------|---------|
| `public/app.js` | 1,681 | All frontend logic |
| `public/style.css` | 1,173 | All styles |
| `public/index.html` | 367 | Static HTML template |

**Current architecture issues:**
- Single monolithic JS file with global mutable state
- Manual DOM manipulation (`innerHTML`, `getElementById`)
- Inline `onclick` handlers
- Hard to test individual components
- No type safety

---

## Target Architecture

```
frontend/
├── src/
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── tabs.svelte.ts        # Current tab, URL hash sync
│   │   │   ├── traces.svelte.ts      # Traces state + filters
│   │   │   ├── logs.svelte.ts        # Logs state + filters
│   │   │   ├── metrics.svelte.ts     # Metrics state + filters
│   │   │   ├── timeline.svelte.ts    # Timeline state + filters
│   │   │   ├── websocket.svelte.ts   # WebSocket connection
│   │   │   └── theme.svelte.ts       # Dark/light mode
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.svelte
│   │   │   │   ├── Tabs.svelte
│   │   │   │   ├── SplitPanel.svelte
│   │   │   │   └── FilterBar.svelte
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   ├── EmptyState.svelte
│   │   │   │   ├── Badge.svelte
│   │   │   │   └── KeyboardHelp.svelte
│   │   │   │
│   │   │   ├── timeline/
│   │   │   │   ├── TimelineTab.svelte
│   │   │   │   ├── TimelineList.svelte
│   │   │   │   ├── TimelineItem.svelte
│   │   │   │   └── TimelineDetail.svelte
│   │   │   │
│   │   │   ├── traces/
│   │   │   │   ├── TracesTab.svelte
│   │   │   │   ├── TracesTable.svelte
│   │   │   │   ├── TraceRow.svelte
│   │   │   │   ├── TraceDetail.svelte
│   │   │   │   └── SpanTree.svelte
│   │   │   │
│   │   │   ├── logs/
│   │   │   │   ├── LogsTab.svelte
│   │   │   │   ├── LogsTable.svelte
│   │   │   │   └── LogDetail.svelte
│   │   │   │
│   │   │   ├── metrics/
│   │   │   │   ├── MetricsTab.svelte
│   │   │   │   ├── MetricsSummary.svelte
│   │   │   │   └── MetricsTable.svelte
│   │   │   │
│   │   │   ├── models/
│   │   │   │   └── ModelsTab.svelte
│   │   │   │
│   │   │   └── analytics/
│   │   │       ├── AnalyticsTab.svelte
│   │   │       ├── TokenTrendsChart.svelte
│   │   │       ├── CostByToolChart.svelte
│   │   │       └── DailySummary.svelte
│   │   │
│   │   ├── api/
│   │   │   └── client.ts             # API fetch helpers
│   │   │
│   │   └── utils/
│   │       ├── format.ts             # formatTime, formatNumber, etc.
│   │       └── keyboard.ts           # Keyboard shortcut handling
│   │
│   ├── App.svelte                    # Root component
│   ├── main.ts                       # Entry point
│   └── app.css                       # Global styles
│
├── index.html                        # Vite entry HTML
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## State Management with Svelte 5 Runes

### Example: Traces Store

```typescript
// src/lib/stores/traces.svelte.ts
import { api } from '$lib/api/client'

export const traceFilters = $state({
  q: '',
  model: '',
  status: '',
  dateRange: '',
  date_from: null as number | null,
  date_to: null as number | null
})

export const traces = $state<Trace[]>([])
export const selectedTraceId = $state<string | null>(null)
export const selectedTrace = $state<TraceDetail | null>(null)

export async function loadTraces() {
  const params = new URLSearchParams()
  if (traceFilters.q) params.set('q', traceFilters.q)
  if (traceFilters.model) params.set('model', traceFilters.model)
  if (traceFilters.status) params.set('status', traceFilters.status)
  if (traceFilters.date_from) params.set('date_from', String(traceFilters.date_from))
  
  const data = await api.get(`/api/traces?${params}`)
  traces.length = 0
  traces.push(...data)
}

export async function selectTrace(id: string) {
  selectedTraceId = id
  const data = await api.get(`/api/traces/${id}/tree`)
  selectedTrace = data
}
```

### Example: WebSocket Store

```typescript
// src/lib/stores/websocket.svelte.ts
export const connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting')

let ws: WebSocket | null = null
let retryDelay = 1000

export function initWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${location.host}/ws`)
  
  ws.onopen = () => {
    connectionStatus = 'connected'
    retryDelay = 1000
  }
  
  ws.onclose = () => {
    connectionStatus = 'disconnected'
    setTimeout(initWebSocket, Math.min(retryDelay *= 1.5, 30000))
  }
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    handleMessage(msg)
  }
}

function handleMessage(msg: { type: string; payload: any }) {
  switch (msg.type) {
    case 'new_trace':
      // Import and update traces store
      break
    case 'new_log':
      // Import and update logs store
      break
    case 'stats_update':
      // Import and update stats store
      break
  }
}
```

---

## Build Integration

### Vite Configuration

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
})
```

### Package Scripts

```json
{
  "scripts": {
    "dev:frontend": "cd frontend && npm run dev",
    "build:frontend": "cd frontend && npm run build",
    "start": "npm run build:frontend && node server.js",
    "dev": "concurrently \"npm run dev:frontend\" \"node server.js\""
  }
}
```

---

## Migration Strategy

### Phase 0: Setup (S - 2 hours)

1. Create `frontend/` directory with Vite + Svelte
2. Configure build output to `public/`
3. Verify Express serves built assets
4. Add dev scripts with proxy to backend

**Deliverable:** Build works, `npm run dev` shows blank Svelte app

### Phase 1: Scaffold and Shared Components (S - 4 hours)

1. Create basic `App.svelte` with header and tabs
2. Port CSS to `app.css` (mostly copy)
3. Create shared components: `EmptyState`, `Badge`, `SplitPanel`
4. Create stores: `tabs`, `theme`, `websocket`
5. Port keyboard shortcuts

**Deliverable:** App shell works with tab switching and theme toggle

### Phase 2: Migrate Logs Tab (M - 4 hours)

Start with Logs as it's simpler than Traces:

1. Create `LogsTab.svelte`, `LogsTable.svelte`, `LogDetail.svelte`
2. Create `logs.svelte.ts` store with filters
3. Wire up to API and WebSocket
4. Test keyboard navigation

**Deliverable:** Logs tab fully functional in Svelte

### Phase 3: Migrate Metrics Tab (S - 3 hours)

Similar to Logs but simpler (no detail panel):

1. Create `MetricsTab.svelte`, `MetricsSummary.svelte`, `MetricsTable.svelte`
2. Create `metrics.svelte.ts` store

**Deliverable:** Metrics tab fully functional

### Phase 4: Migrate Traces Tab (M - 6 hours)

Most complex due to span tree:

1. Create `TracesTab.svelte`, `TracesTable.svelte`, `TraceDetail.svelte`
2. Create `SpanTree.svelte` with recursive rendering
3. Create `traces.svelte.ts` store
4. Handle trace tree API

**Deliverable:** Traces tab fully functional with span tree

### Phase 5: Migrate Timeline Tab (M - 5 hours)

1. Create `TimelineTab.svelte`, `TimelineList.svelte`, `TimelineDetail.svelte`
2. Create `timeline.svelte.ts` store
3. Handle related logs section

**Deliverable:** Timeline tab fully functional

### Phase 6: Migrate Models + Analytics (M - 4 hours)

1. Create `ModelsTab.svelte` with model cards
2. Create `AnalyticsTab.svelte` with chart components
3. Port simple bar chart rendering

**Deliverable:** All tabs complete

### Phase 7: Cleanup and Testing (S - 3 hours)

1. Delete old `public/app.js`
2. Update E2E tests if needed
3. Test all keyboard shortcuts
4. Test WebSocket reconnection
5. Test in Docker

**Deliverable:** Migration complete, old code removed

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Theme flash on load | Keep inline `<script>` in index.html for early theme detection |
| Keyboard shortcuts break | Test each shortcut after migrating related tab |
| WebSocket race conditions | Keep `currentTab` guards when updating stores |
| Build step breaks npx | Ensure `prepublishOnly` runs build; test with `npx` |
| Contributor friction | Document dev setup in README |

---

## Decision: Why Not SvelteKit?

| Factor | Vite + Svelte | SvelteKit |
|--------|---------------|-----------|
| Routing | Not needed (single page) | Overkill |
| SSR | Not needed (local tool) | Unnecessary complexity |
| Express integration | Simple (serve static) | Would need adapter |
| Learning curve | Minimal | Higher |
| Bundle size | Smaller | Larger |

**Verdict:** Use Vite + Svelte. SvelteKit's features (routing, SSR, endpoints) aren't needed and would complicate the existing Express backend.

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 0: Setup | S | 2h |
| Phase 1: Scaffold | S | 4h |
| Phase 2: Logs | M | 4h |
| Phase 3: Metrics | S | 3h |
| Phase 4: Traces | M | 6h |
| Phase 5: Timeline | M | 5h |
| Phase 6: Models + Analytics | M | 4h |
| Phase 7: Cleanup | S | 3h |
| **Total** | | **~31 hours (4-5 days)** |

---

## Next Steps

1. [ ] Create `frontend/` directory with Vite + Svelte scaffold
2. [ ] Configure build to output to `public/`
3. [ ] Start with Phase 1: App shell + shared components
4. [ ] Migrate tabs in order: Logs → Metrics → Traces → Timeline → Models → Analytics

---

_Created: 2025-12-26_
