import { createLoadState } from './load-state.svelte'
import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'

export interface Log {
  id: string
  timestamp: number
  severity_text: string
  severity_number?: number
  service_name?: string
  event_name?: string
  body?: string
  trace_id?: string
  span_id?: string
  attributes?: Record<string, unknown>
  resource_attributes?: Record<string, unknown>
}

export interface LogFilters {
  q: string
  service_name: string
  event_name: string
  severity_min: number | null
}

export interface FilterOptions {
  services: string[]
  event_names: string[]
}

export const logs = $state<Log[]>([])
export const selectedLogId = $state<{ value: string | null }>({ value: null })
export const selectedLog = $state<{ value: Log | null }>({ value: null })
export const logFilters = $state<LogFilters>({
  q: '',
  service_name: '',
  event_name: '',
  severity_min: null,
})
export const filterOptions = $state<FilterOptions>({
  services: [],
  event_names: [],
})

let listRequest = 0
export const logsState = createLoadState()

export async function loadLogs() {
  const request = ++listRequest
  logsState.loading = true
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (logFilters.q) params.set('q', logFilters.q)
    if (logFilters.service_name) params.set('service_name', logFilters.service_name)
    if (logFilters.event_name) params.set('event_name', logFilters.event_name)
    if (logFilters.severity_min != null) params.set('severity_min', String(logFilters.severity_min))

    const data = await api.get<{ logs: Log[] }>(`/api/logs?${params}`)
    if (request !== listRequest) return
    logs.length = 0
    logs.push(...(data.logs || []))
    logsState.loaded = true
    logsState.error = ''
  } catch (e) {
    if (request === listRequest) logsState.error = 'Could not load logs.'
  } finally {
    if (request === listRequest) logsState.loading = false
  }
}

export async function loadFilterOptions() {
  try {
    const data = await api.get<{ services?: string[]; event_names?: string[] }>('/api/logs/filters')
    filterOptions.services = data.services || []
    filterOptions.event_names = data.event_names || []
  } catch (e) {
    console.error('Failed to load log filter options:', e)
  }
}

let selectionRequest = 0
export const logsDetailState = createLoadState()

export async function selectLog(id: string) {
  const request = ++selectionRequest
  selectedLogId.value = id
  selectedLog.value = null
  logsDetailState.loading = true
  logsDetailState.loaded = false
  logsDetailState.error = ''
  try {
    const log = await api.get<Log>(`/api/logs/${encodeURIComponent(id)}`)
    if (request !== selectionRequest) return
    selectedLog.value = log
    logsDetailState.loaded = true
  } catch (e) {
    if (request !== selectionRequest) return
    if (request === selectionRequest) logsDetailState.error = 'Could not load this log.'
    selectedLog.value = null
  } finally {
    if (request === selectionRequest) logsDetailState.loading = false
  }
}

export function clearSelection() {
  selectionRequest++
  selectedLogId.value = null
  selectedLog.value = null
}

export function clearFilters() {
  logFilters.q = ''
  logFilters.service_name = ''
  logFilters.event_name = ''
  logFilters.severity_min = null
  loadLogs()
}

export function initLogsSync() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = onMessage((msg) => {
    if (msg.type === 'new_log' && tabState.current === 'logs' && !timer) {
      // WebSocket summaries omit searchable fields and may truncate the body.
      timer = setTimeout(() => {
        timer = undefined
        if (tabState.current !== 'logs') return
        void loadLogs()
        void loadFilterOptions()
      }, 50)
    }
  })
  return () => {
    unsubscribe()
    clearTimeout(timer)
    listRequest++
    selectionRequest++
  }
}
