import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'

export interface Stats {
  total_requests: number
  total_tokens: number
  total_cost: number
  avg_duration: number
}

export const stats = $state<Stats>({
  total_requests: 0,
  total_tokens: 0,
  total_cost: 0,
  avg_duration: 0
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
  onMessage((msg) => {
    if (msg.type === 'stats_update' && msg.payload) {
      Object.assign(stats, msg.payload)
    }
  })
}
