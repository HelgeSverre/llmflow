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
  severity_min: null
})
export const filterOptions = $state<FilterOptions>({
  services: [],
  event_names: []
})

export async function loadLogs() {
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (logFilters.q) params.set('q', logFilters.q)
    if (logFilters.service_name) params.set('service_name', logFilters.service_name)
    if (logFilters.event_name) params.set('event_name', logFilters.event_name)
    if (logFilters.severity_min != null) params.set('severity_min', String(logFilters.severity_min))

    const data = await api.get<{ logs: Log[] }>(`/api/logs?${params}`)
    logs.length = 0
    logs.push(...(data.logs || []))
  } catch (e) {
    console.error('Failed to load logs:', e)
  }
}

export async function loadFilterOptions() {
  try {
    const data = await api.get<{ services?: string[], event_names?: string[] }>('/api/logs/filters')
    filterOptions.services = data.services || []
    filterOptions.event_names = data.event_names || []
  } catch (e) {
    console.error('Failed to load log filter options:', e)
  }
}

export async function selectLog(id: string) {
  selectedLogId.value = id
  try {
    const log = await api.get<Log>(`/api/logs/${id}`)
    selectedLog.value = log
  } catch (e) {
    console.error('Failed to load log:', e)
    selectedLog.value = null
  }
}

export function clearSelection() {
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

function logMatchesFilters(log: Log): boolean {
  if (logFilters.service_name && log.service_name !== logFilters.service_name) return false
  if (logFilters.event_name && log.event_name !== logFilters.event_name) return false
  if (logFilters.q) return false // Text search requires server
  return true
}

export function initLogsSync() {
  onMessage((msg) => {
    if (msg.type === 'new_log' && tabState.current === 'logs') {
      const log = msg.payload as Log
      if (!logMatchesFilters(log)) return
      if (!logs.find(l => l.id === log.id)) {
        logs.unshift(log)
        if (logs.length > 100) logs.length = 100
      }
    }
  })
}
