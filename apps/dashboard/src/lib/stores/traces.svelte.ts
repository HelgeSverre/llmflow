import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'
import type { TraceTree, TraceTreeSpan } from '$lib/trace/tree'

export interface Trace {
  trace_id?: string
  input?: unknown
  output?: unknown
  attributes?: Record<string, unknown>
  id: string
  timestamp: number
  duration_ms: number | null
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
  spans?: TraceTreeSpan[]
  partial?: boolean
}

export interface TraceFilters {
  q: string
  model: string
  status: string
  dateRange: string
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
})
export const filterOptions = $state<TraceFilterOptions>({
  models: [],
})

function getDateRange(range: string): number | null {
  if (!range) return null
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const day = 24 * hour

  switch (range) {
    case '1h':
      return now - hour
    case '24h':
      return now - day
    case '7d':
      return now - 7 * day
    default:
      return null
  }
}

let listGeneration = 0

export async function loadTraces() {
  const generation = ++listGeneration
  if (tabState.current !== 'traces') return

  try {
    const params = new URLSearchParams({ limit: '50' })
    if (traceFilters.q) params.set('q', traceFilters.q)
    if (traceFilters.model) params.set('model', traceFilters.model)
    if (traceFilters.status) params.set('status', traceFilters.status)

    const from = getDateRange(traceFilters.dateRange)
    if (from) params.set('date_from', String(from))

    const data = await api.get<Trace[]>(`/api/traces?${params}`)
    if (generation !== listGeneration || tabState.current !== 'traces') return
    traces.length = 0
    traces.push(...(data || []))
  } catch (e) {
    console.error('Failed to load traces:', e)
  }
}

export async function loadFilterOptions() {
  try {
    const data = await api.get<{ model: string }[]>('/api/models')
    filterOptions.models = data.map((m) => m.model).filter(Boolean)
  } catch (e) {
    console.error('Failed to load trace filter options:', e)
  }
}

let selectionGeneration = 0

export async function selectTrace(id: string) {
  const generation = ++selectionGeneration
  selectedTraceId.value = id
  selectedTrace.value = null
  try {
    const [detail, tree] = await Promise.all([
      api.get<TraceDetail>(`/api/traces/${id}`),
      api.get<TraceTree>(`/api/traces/${id}/tree`),
    ])
    if (selectionGeneration !== generation) return
    selectedTrace.value = { ...detail, spans: tree.spans, partial: tree.trace?.partial }
  } catch (e) {
    console.error('Failed to load trace:', e)
    if (selectionGeneration === generation) selectedTrace.value = null
  }
}

export function clearSelection() {
  selectionGeneration++
  selectedTraceId.value = null
  selectedTrace.value = null
}

export function clearFilters() {
  traceFilters.q = ''
  traceFilters.model = ''
  traceFilters.status = ''
  traceFilters.dateRange = ''
  loadTraces()
}

export function initTracesSync() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = onMessage((msg) => {
    if ((msg.type === 'new_trace' || msg.type === 'new_span') && tabState.current === 'traces') {
      // Summaries lack searchable bodies. Reload the authoritative filtered query.
      if (timer) return
      timer = setTimeout(() => {
        timer = undefined
        void loadTraces()
      }, 100)
    }
  })
  return () => {
    unsubscribe()
    clearTimeout(timer)
    listGeneration++
  }
}
