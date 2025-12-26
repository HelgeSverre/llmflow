import { api } from '$lib/api/client'

export interface DailyStats {
  date: string
  request_count: number
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  total_cost: number
}

export interface ToolCost {
  tool: string
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
  by_model: []
})
export const analyticsDays = $state<{ value: number }>({ value: 30 })

export async function loadAnalytics() {
  try {
    const data = await api.get<Analytics>(`/api/analytics?days=${analyticsDays.value}`)
    analytics.daily = data.daily || []
    analytics.by_tool = data.by_tool || []
    analytics.by_model = data.by_model || []
  } catch (e) {
    console.error('Failed to load analytics:', e)
  }
}
