import { createLoadState } from './load-state.svelte'
import type { Log } from './logs.svelte'
import type { TraceDetail } from './traces.svelte'
import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'

export interface TimelineItem {
  id: string
  type: 'trace' | 'log'
  timestamp: number
  title: string
  subtitle?: string
  model?: string
  service_name?: string
  tool?: string
  status?: string
  duration_ms?: number
  tokens?: number
  cost?: number
  severity_text?: string
  data?: Record<string, unknown>
}

export interface TimelineFilters {
  q: string
  tool: string
  type: string
  dateRange: string
}

export const timelineItems = $state<TimelineItem[]>([])
export const selectedItem = $state<{ value: TimelineItem | null }>({ value: null })
export const selectedItemData = $state<{ value: TraceDetail | Log | null }>({ value: null })
export const selectedItemError = $state({ value: '' })
export const relatedLogs = $state<Log[]>([])
export const timelineFilters = $state<TimelineFilters>({
  q: '',
  tool: '',
  type: '',
  dateRange: '',
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

let listRequest = 0
export const timelineState = createLoadState()

export async function loadTimeline() {
  if (tabState.current !== 'timeline') return
  const request = ++listRequest

  timelineState.loading = true
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (timelineFilters.q) params.set('q', timelineFilters.q)
    if (timelineFilters.tool) params.set('tool', timelineFilters.tool)
    if (timelineFilters.type) params.set('type', timelineFilters.type)

    const from = getDateRange(timelineFilters.dateRange)
    if (from) params.set('date_from', String(from))

    const data = await api.get<TimelineItem[]>(`/api/timeline?${params}`)
    if (request !== listRequest) return
    timelineItems.length = 0
    timelineItems.push(...(data || []))
    timelineState.loaded = true
    timelineState.error = ''
  } catch (e) {
    if (request === listRequest) timelineState.error = 'Could not load timeline.'
  } finally {
    if (request === listRequest) timelineState.loading = false
  }
}

let selectionRequest = 0
export async function selectTimelineItem(item: TimelineItem) {
  const request = ++selectionRequest
  selectedItem.value = item
  selectedItemData.value = null
  selectedItemError.value = ''
  relatedLogs.length = 0
  try {
    if (item.type === 'trace') {
      const detail = await api.get<TraceDetail>(`/api/traces/${encodeURIComponent(item.id)}`)
      if (request !== selectionRequest) return
      selectedItemData.value = detail
      if (detail.trace.trace_id) {
        const result = await api.get<{ logs: Log[] }>(
          `/api/logs?trace_id=${encodeURIComponent(detail.trace.trace_id)}&limit=10`,
        )
        if (request === selectionRequest) relatedLogs.push(...result.logs)
      }
    } else {
      const detail = await api.get<Log>(`/api/logs/${encodeURIComponent(item.id)}`)
      if (request === selectionRequest) selectedItemData.value = detail
    }
  } catch (e) {
    if (request !== selectionRequest) return
    selectedItemError.value = selectedItemData.value
      ? 'Could not load related logs.'
      : 'Could not load details.'
    console.error('Failed to load timeline item:', e)
  }
}

export function clearSelection() {
  selectionRequest++
  selectedItem.value = null
  selectedItemData.value = null
  selectedItemError.value = ''
  relatedLogs.length = 0
}

export function clearFilters() {
  timelineFilters.q = ''
  timelineFilters.tool = ''
  timelineFilters.type = ''
  timelineFilters.dateRange = ''
}

export function initTimelineSync() {
  return onMessage((msg) => {
    if (tabState.current !== 'timeline') return

    if (msg.type === 'new_trace' || msg.type === 'new_log') {
      // Reload timeline to get new items in proper order
      loadTimeline()
    }
  })
}
