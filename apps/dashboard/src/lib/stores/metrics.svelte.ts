import { createLoadState } from './load-state.svelte'
import { onMessage } from './websocket.svelte'
import { api } from '$lib/api/client'
import { tabState } from './tabs.svelte'

export interface Metric {
  id: string
  timestamp: number
  name: string
  metric_type: string
  value_int: number | null
  value_double: number | null
  histogram_data: string | null
  service_name: string | null
  unit: string | null
}

export interface MetricSummary {
  unit?: string
  first_seen?: number
  last_seen?: number
  name: string
  metric_type: string
  service_name?: string
  data_points: number
  sum_int: number | null
  avg_value: number | null
  sum_value: number | null
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
  metric_type: '',
})
export const filterOptions = $state<MetricFilterOptions>({
  names: [],
  services: [],
})

let listRequest = 0
let summaryRequest = 0
function metricQuery() {
  const params = new URLSearchParams()
  for (const field of ['name', 'service_name', 'metric_type'] as const) {
    if (metricFilters[field]) params.set(field, metricFilters[field])
  }
  return params
}

export const metricsState = createLoadState()

export async function loadMetrics() {
  if (tabState.current !== 'metrics') return

  const request = ++listRequest
  metricsState.loading = true
  try {
    const params = metricQuery()
    params.set('limit', '100')

    const data = await api.get<{ metrics: Metric[] }>(`/api/metrics?${params}`)
    if (request !== listRequest) return
    metrics.length = 0
    metrics.push(...(data.metrics || []))
    metricsState.loaded = true
    metricsState.error = ''
  } catch (e) {
    if (request === listRequest) metricsState.error = 'Could not load metrics.'
  } finally {
    if (request === listRequest) metricsState.loading = false
  }
}

export const metricSummaryState = createLoadState()

export async function loadMetricsSummary() {
  if (tabState.current !== 'metrics') return

  const request = ++summaryRequest
  metricSummaryState.loading = true
  try {
    const params = metricQuery()
    params.set('aggregation', 'summary')
    const data = await api.get<{ summary: MetricSummary[] }>(`/api/metrics?${params}`)
    if (request !== summaryRequest) return
    metricsSummary.length = 0
    metricsSummary.push(...(data.summary || []))
    metricSummaryState.loaded = true
    metricSummaryState.error = ''
  } catch (e) {
    if (request === summaryRequest) metricSummaryState.error = 'Could not load metric summaries.'
  } finally {
    if (request === summaryRequest) metricSummaryState.loading = false
  }
}

export async function loadFilterOptions() {
  try {
    const data = await api.get<{ names?: string[]; services?: string[] }>('/api/metrics/filters')
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
}

export function initMetricsSync() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = onMessage((message) => {
    if (message.type !== 'new_metric' || tabState.current !== 'metrics' || timer) return
    timer = setTimeout(() => {
      timer = undefined
      void loadMetrics()
      void loadMetricsSummary()
      void loadFilterOptions()
    }, 100)
  })
  return () => {
    stop()
    clearTimeout(timer)
  }
}
