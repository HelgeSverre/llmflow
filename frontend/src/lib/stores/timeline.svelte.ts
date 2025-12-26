import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'

export interface TimelineItem {
  id: string
  type: 'trace' | 'log' | 'metric'
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
  metric_type?: string
  value?: number
  data?: unknown
}

export interface TimelineFilters {
  q: string
  tool: string
  type: string
  dateRange: string
  date_from: number | null
}

export const timelineItems = $state<TimelineItem[]>([])
export const selectedItem = $state<{ value: TimelineItem | null }>({ value: null })
export const selectedItemData = $state<{ value: unknown }>({ value: null })
export const relatedLogs = $state<unknown[]>([])
export const timelineFilters = $state<TimelineFilters>({
  q: '',
  tool: '',
  type: '',
  dateRange: '',
  date_from: null
})

function getDateRange(range: string): number | null {
  if (!range) return null
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  
  switch (range) {
    case '1h': return now - hour
    case '24h': return now - day
    case '7d': return now - 7 * day
    default: return null
  }
}

export async function loadTimeline() {
  if (tabState.current !== 'timeline') return
  
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (timelineFilters.q) params.set('q', timelineFilters.q)
    if (timelineFilters.tool) params.set('tool', timelineFilters.tool)
    if (timelineFilters.type) params.set('type', timelineFilters.type)
    
    const from = getDateRange(timelineFilters.dateRange)
    if (from) params.set('date_from', String(from))

    const data = await api.get<TimelineItem[]>(`/api/timeline?${params}`)
    timelineItems.length = 0
    timelineItems.push(...(data || []))
  } catch (e) {
    console.error('Failed to load timeline:', e)
  }
}

export async function selectTimelineItem(item: TimelineItem) {
  selectedItem.value = item
  relatedLogs.length = 0
  
  try {
    if (item.type === 'trace') {
      const detail = await api.get<unknown>(`/api/traces/${item.id}`)
      selectedItemData.value = detail
      
      // Load related logs if trace has a trace_id
      try {
        const logs = await api.get<{ logs: unknown[] }>(`/api/logs?trace_id=${item.id}&limit=10`)
        relatedLogs.push(...(logs.logs || []))
      } catch {
        // ignore
      }
    } else if (item.type === 'log') {
      const detail = await api.get<unknown>(`/api/logs/${item.id}`)
      selectedItemData.value = detail
    } else if (item.type === 'metric') {
      selectedItemData.value = item.data || item
    }
  } catch (e) {
    console.error('Failed to load timeline item:', e)
    selectedItemData.value = null
  }
}

export function clearSelection() {
  selectedItem.value = null
  selectedItemData.value = null
  relatedLogs.length = 0
}

export function clearFilters() {
  timelineFilters.q = ''
  timelineFilters.tool = ''
  timelineFilters.type = ''
  timelineFilters.dateRange = ''
  timelineFilters.date_from = null
  loadTimeline()
}

export function initTimelineSync() {
  onMessage((msg) => {
    if (tabState.current !== 'timeline') return
    
    if (msg.type === 'new_trace' || msg.type === 'new_log') {
      // Reload timeline to get new items in proper order
      loadTimeline()
    }
  })
}
