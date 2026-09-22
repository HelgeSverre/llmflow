import { createLoadState } from './load-state.svelte'
import { api } from '$lib/api/client'

export interface DailyStats {
  date: string
  requests: number
  tokens: number
  prompt_tokens: number
  completion_tokens: number
  cost: number
}

export interface ToolCost {
  service_name: string
  provider: string
  total_cost: number
  request_count: number
}

export interface ModelCost {
  model: string
  total_cost: number
  request_count: number
}

export interface Analytics {
  daily: DailyStats[]
  by_tool: ToolCost[]
  by_model: ModelCost[]
}

export const analytics = $state<Analytics>({
  daily: [],
  by_tool: [],
  by_model: [],
})
export const analyticsDays = $state<{ value: number }>({ value: 30 })

let analyticsRequest = 0
export const analyticsState = createLoadState()

export async function loadAnalytics() {
  const request = ++analyticsRequest
  analyticsState.loading = true
  try {
    const data = await api.get<Analytics>(`/api/analytics?days=${analyticsDays.value}`)
    if (request !== analyticsRequest) return
    analytics.daily = data.daily || []
    analytics.by_tool = data.by_tool || []
    analytics.by_model = data.by_model || []
    analyticsState.loaded = true
    analyticsState.error = ''
  } catch (e) {
    if (request === analyticsRequest) analyticsState.error = 'Could not load analytics.'
  } finally {
    if (request === analyticsRequest) analyticsState.loading = false
  }
}
