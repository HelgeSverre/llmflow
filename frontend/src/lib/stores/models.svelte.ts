import { api } from '$lib/api/client'

export interface ModelStats {
  model: string
  request_count: number
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  total_cost: number
  avg_latency: number
}

export const modelStats = $state<ModelStats[]>([])

export async function loadModels() {
  try {
    const data = await api.get<ModelStats[]>('/api/models')
    modelStats.length = 0
    modelStats.push(...(data || []))
  } catch (e) {
    console.error('Failed to load models:', e)
  }
}
