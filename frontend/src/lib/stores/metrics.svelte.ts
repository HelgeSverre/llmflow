import { api } from '$lib/api/client'
import { tabState } from './tabs.svelte'

export interface Metric {
  id: string
  timestamp: number
  name: string
  metric_type: string
  value?: number
  sum?: number
  count?: number
  min?: number
  max?: number
  service_name?: string
  unit?: string
  attributes?: Record<string, unknown>
}

export interface MetricSummary {
  name: string
  metric_type: string
  service_name?: string
  data_points: number
  latest_value?: number
  sum?: number
  avg?: number
  min?: number
  max?: number
}

export interface MetricFilters {
  name: string
  service_name: string
  metric_type: string
}

export interface MetricFilterOptions {
  names: string[]
  services: string[]
}

export const metrics = $state<Metric[]>([])
export const metricsSummary = $state<MetricSummary[]>([])
export const metricFilters = $state<MetricFilters>({
  name: '',
  service_name: '',
  metric_type: ''
})
export const filterOptions = $state<MetricFilterOptions>({
  names: [],
  services: []
})

export async function loadMetrics() {
  if (tabState.current !== 'metrics') return
  
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (metricFilters.name) params.set('name', metricFilters.name)
    if (metricFilters.service_name) params.set('service_name', metricFilters.service_name)
    if (metricFilters.metric_type) params.set('metric_type', metricFilters.metric_type)

    const data = await api.get<{ metrics: Metric[] }>(`/api/metrics?${params}`)
    metrics.length = 0
    metrics.push(...(data.metrics || []))
  } catch (e) {
    console.error('Failed to load metrics:', e)
  }
}

export async function loadMetricsSummary() {
  if (tabState.current !== 'metrics') return
  
  try {
    const data = await api.get<{ summary: MetricSummary[] }>('/api/metrics?aggregation=summary')
    metricsSummary.length = 0
    metricsSummary.push(...(data.summary || []))
  } catch (e) {
    console.error('Failed to load metrics summary:', e)
  }
}

export async function loadFilterOptions() {
  try {
    const data = await api.get<{ names?: string[], services?: string[] }>('/api/metrics/filters')
    filterOptions.names = data.names || []
    filterOptions.services = data.services || []
  } catch (e) {
    console.error('Failed to load metric filter options:', e)
  }
}

export function clearFilters() {
  metricFilters.name = ''
  metricFilters.service_name = ''
  metricFilters.metric_type = ''
  loadMetrics()
}
