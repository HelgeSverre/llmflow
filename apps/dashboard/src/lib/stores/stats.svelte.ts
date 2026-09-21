import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'

export interface Stats {
  total_requests: number | null
  total_tokens: number | null
  total_cost: number | null
  avg_duration: number | null
}

export const stats = $state<Stats>({
  total_requests: null,
  total_tokens: null,
  total_cost: null,
  avg_duration: null,
})

export async function loadStats() {
  try {
    const data = await api.get<Stats>('/api/stats')
    Object.assign(stats, data)
  } catch (e) {
    console.error('Failed to load stats:', e)
  }
}

export function initStatsSync() {
  return onMessage((msg) => {
    if (msg.type === 'stats_update' && msg.payload) {
      Object.assign(stats, msg.payload)
    }
  })
}
