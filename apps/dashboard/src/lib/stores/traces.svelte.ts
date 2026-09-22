import { createLoadState } from './load-state.svelte'
import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'
import type { TraceTree, TraceTreeSpan } from '$lib/trace/tree'

export interface Trace {
  has_child_error?: boolean
  session_id?: string
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
  service_name: string
  dateFrom?: number
  dateTo?: number
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
  service_name: '',
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

export const tracesState = createLoadState()

export async function loadTraces() {
  const generation = ++listGeneration
  if (tabState.current !== 'traces') return

  tracesState.loading = true
  try {
    const params = new URLSearchParams({ limit: '50' })
    if (traceFilters.q) params.set('q', traceFilters.q)
    if (traceFilters.model) params.set('model', traceFilters.model)
    if (traceFilters.status) params.set('status', traceFilters.status)

    const from =
      traceFilters.dateRange === 'custom'
        ? traceFilters.dateFrom
        : getDateRange(traceFilters.dateRange)
    if (traceFilters.service_name) params.set('service_name', traceFilters.service_name)
    if (traceFilters.dateRange === 'custom' && traceFilters.dateTo)
      params.set('date_to', String(traceFilters.dateTo))
    if (from) params.set('date_from', String(from))

    const data = await api.get<Trace[]>(`/api/traces?${params}`)
    if (generation !== listGeneration || tabState.current !== 'traces') return
    traces.length = 0
    traces.push(...(data || []))
    tracesState.loaded = true
    tracesState.error = ''
  } catch (e) {
    if (generation === listGeneration) tracesState.error = 'Could not load traces.'
  } finally {
    if (generation === listGeneration) tracesState.loading = false
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

export const tracesDetailState = createLoadState()

export async function selectTrace(id: string) {
  const generation = ++selectionGeneration
  selectedTraceId.value = id
  selectedTrace.value = null
  tracesDetailState.loading = true
  tracesDetailState.loaded = false
  tracesDetailState.error = ''
  try {
    const [detail, tree] = await Promise.all([
      api.get<TraceDetail>(`/api/traces/${id}`),
      api.get<TraceTree>(`/api/traces/${id}/tree`),
    ])
    if (selectionGeneration !== generation) return
    selectedTrace.value = { ...detail, spans: tree.spans, partial: tree.trace?.partial }
    tracesDetailState.loaded = true
  } catch (e) {
    if (selectionGeneration === generation) tracesDetailState.error = 'Could not load this trace.'
    if (selectionGeneration === generation) selectedTrace.value = null
  } finally {
    if (selectionGeneration === generation) tracesDetailState.loading = false
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
  traceFilters.service_name = ''
  traceFilters.dateFrom = undefined
  traceFilters.dateTo = undefined
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
