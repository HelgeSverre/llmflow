export function formatTime(timestamp: number | string): string {
  const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '-'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toString()
}

export function formatCost(cost: number | null | undefined): string {
  if (cost == null) return '-'
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return '<$0.01'
  return '$' + cost.toFixed(2)
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return '-'
  if (ms < 1000) return Math.round(ms) + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
