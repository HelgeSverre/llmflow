export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export const connectionStatus = $state<{ value: ConnectionStatus }>({ value: 'connecting' })

let ws: WebSocket | null = null
let retryDelay = 1000
const WS_MAX_RETRY = 30000

type MessageHandler = (msg: { type: string; payload: unknown }) => void
const handlers: MessageHandler[] = []

export function onMessage(handler: MessageHandler) {
  handlers.push(handler)
  return () => {
    const idx = handlers.indexOf(handler)
    if (idx > -1) handlers.splice(idx, 1)
  }
}

export function initWebSocket() {
  if (typeof window === 'undefined') return
  
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${location.host}/ws`)
  
  ws.onopen = () => {
    connectionStatus.value = 'connected'
    retryDelay = 1000
  }
  
  ws.onclose = () => {
    connectionStatus.value = 'disconnected'
    setTimeout(initWebSocket, Math.min(retryDelay *= 1.5, WS_MAX_RETRY))
  }
  
  ws.onerror = () => {
    connectionStatus.value = 'disconnected'
  }
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      handlers.forEach(h => h(msg))
    } catch (e) {
      console.error('WebSocket message parse error:', e)
    }
  }
}
