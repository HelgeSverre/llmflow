import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'

export interface Trace {
  id: string
  timestamp: number
  duration_ms: number
  provider?: string
  model?: string
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  estimated_cost?: number
  status?: number
  error?: string
  span_type?: string
  span_name?: string
  service_name?: string
}

export interface Span {
  id: string
  trace_id: string
  parent_id?: string
  name: string
  span_type?: string
  start_time: number
  end_time?: number
  duration_ms?: number
  status?: string
  attributes?: Record<string, unknown>
  children?: Span[]
}

export interface TraceDetail {
  trace: Trace
  request?: {
    method: string
    path: string
    headers: Record<string, string>
    body: unknown
  }
  response?: {
    status: number
    headers: Record<string, string>
    body: unknown
  }
  spans?: Span[]
}

export interface TraceFilters {
  q: string
  model: string
  status: string
  dateRange: string
  date_from: number | null
  date_to: number | null
}

export interface TraceFilterOptions {
  models: string[]
}

export const traces = $state<Trace[]>([])
export const selectedTraceId = $state<{ value: string | null }>({ value: null })
export const selectedTrace = $state<{ value: TraceDetail | null }>({ value: null })
export const traceFilters = $state<TraceFilters>({
  q: '',
  model: '',
  status: '',
  dateRange: '',
  date_from: null,
  date_to: null
})
export const filterOptions = $state<TraceFilterOptions>({
  models: []
})

function getDateRange(range: string): { from: number | null, to: number | null } {
  if (!range) return { from: null, to: null }
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  
  switch (range) {
    case '1h': return { from: now - hour, to: null }
    case '24h': return { from: now - day, to: null }
    case '7d': return { from: now - 7 * day, to: null }
    default: return { from: null, to: null }
  }
}

export async function loadTraces() {
  if (tabState.current !== 'traces') return
  
  try {
    const params = new URLSearchParams({ limit: '50' })
    if (traceFilters.q) params.set('q', traceFilters.q)
    if (traceFilters.model) params.set('model', traceFilters.model)
    if (traceFilters.status) params.set('status', traceFilters.status)
    
    const { from, to } = getDateRange(traceFilters.dateRange)
    if (from) params.set('date_from', String(from))
    if (to) params.set('date_to', String(to))

    const data = await api.get<Trace[]>(`/api/traces?${params}`)
    traces.length = 0
    traces.push(...(data || []))
  } catch (e) {
    console.error('Failed to load traces:', e)
  }
}

export async function loadFilterOptions() {
  try {
    const data = await api.get<{ model: string }[]>('/api/models')
    filterOptions.models = data.map(m => m.model).filter(Boolean)
  } catch (e) {
    console.error('Failed to load trace filter options:', e)
  }
}

export async function selectTrace(id: string) {
  selectedTraceId.value = id
  try {
    const [detail, tree] = await Promise.all([
      api.get<TraceDetail>(`/api/traces/${id}`),
      api.get<{ spans: Span[] }>(`/api/traces/${id}/tree`).catch(() => ({ spans: [] }))
    ])
    selectedTrace.value = { ...detail, spans: tree.spans }
  } catch (e) {
    console.error('Failed to load trace:', e)
    selectedTrace.value = null
  }
}

export function clearSelection() {
  selectedTraceId.value = null
  selectedTrace.value = null
}

export function clearFilters() {
  traceFilters.q = ''
  traceFilters.model = ''
  traceFilters.status = ''
  traceFilters.dateRange = ''
  traceFilters.date_from = null
  traceFilters.date_to = null
  loadTraces()
}

export function initTracesSync() {
  onMessage((msg) => {
    if (msg.type === 'new_trace' && tabState.current === 'traces') {
      const trace = msg.payload as Trace
      if (!traces.find(t => t.id === trace.id)) {
        traces.unshift(trace)
        if (traces.length > 50) traces.length = 50
      }
    }
  })
}
