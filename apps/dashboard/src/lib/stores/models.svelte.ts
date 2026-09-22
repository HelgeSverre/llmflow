import { createLoadState } from './load-state.svelte'
import { api } from '$lib/api/client'

export interface ModelStats {
  model: string
  request_count: number
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  total_cost: number
  avg_latency: number | null
}

export const modelStats = $state<ModelStats[]>([])

export const modelFilters = $state({ days: 0, sort: 'requests' })
export const modelScope = $state({ from: 0, to: 0 })
let modelRequest = 0
export const modelsState = createLoadState()

export async function loadModels() {
  const request = ++modelRequest
  modelsState.loading = true
  try {
    const to = Date.now()
    const from = modelFilters.days ? to - modelFilters.days * 86400000 : 0
    const data = await api.get<ModelStats[]>(`/api/models?date_from=${from}&date_to=${to}`)
    if (request !== modelRequest) return
    modelScope.from = from
    modelScope.to = to
    modelStats.length = 0
    modelStats.push(...(data || []))
    modelsState.loaded = true
    modelsState.error = ''
  } catch (e) {
    if (request === modelRequest) modelsState.error = 'Could not load models.'
  } finally {
    if (request === modelRequest) modelsState.loading = false
  }
}
