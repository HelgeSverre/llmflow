export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export const connectionStatus = $state<{ value: ConnectionStatus }>({ value: 'connecting' })

let ws: WebSocket | null = null
let retryDelay = 1000
const WS_MAX_RETRY = 30000
let retryTimer: ReturnType<typeof setTimeout> | null = null
let stopped = false

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
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  stopped = false
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${location.host}/ws`)
  ws = socket
  connectionStatus.value = 'connecting'

  socket.onopen = () => {
    if (ws !== socket) return
    connectionStatus.value = 'connected'
    retryDelay = 1000
  }
  socket.onclose = () => {
    if (ws !== socket) return
    ws = null
    connectionStatus.value = 'disconnected'
    if (stopped || retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      initWebSocket()
    }, retryDelay)
    retryDelay = Math.min(retryDelay * 1.5, WS_MAX_RETRY)
  }
  socket.onerror = () => {
    if (ws === socket) connectionStatus.value = 'disconnected'
  }
  socket.onmessage = (event) => {
    if (ws !== socket) return
    let message: Parameters<MessageHandler>[0]
    try {
      message = JSON.parse(event.data)
    } catch (error) {
      console.error('WebSocket message parse error:', error)
      return
    }
    for (const handler of handlers.slice()) {
      try {
        handler(message)
      } catch (error) {
        console.error('WebSocket handler error:', error)
      }
    }
  }
}

export function disconnectWebSocket() {
  stopped = true
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  const socket = ws
  ws = null
  socket?.close()
  retryDelay = 1000
  connectionStatus.value = 'disconnected'
}
