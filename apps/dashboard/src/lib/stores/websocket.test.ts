import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { initWebSocket, disconnectWebSocket, onMessage, connectionStatus } from './websocket.svelte'
class Socket {
  static OPEN = 1
  static CONNECTING = 0
  static instances: Socket[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  constructor(public url: string) {
    Socket.instances.push(this)
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  Socket.instances = []
  vi.stubGlobal('WebSocket', Socket)
})
afterEach(() => {
  disconnectWebSocket()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
test('repeated initialization, stale events and teardown never create overlapping connections', () => {
  initWebSocket()
  initWebSocket()
  expect(Socket.instances).toHaveLength(1)
  const first = Socket.instances[0]
  first.open()
  initWebSocket()
  expect(connectionStatus.value).toBe('connected')
  first.close()
  first.onclose?.()
  vi.advanceTimersByTime(1000)
  expect(Socket.instances).toHaveLength(2)
  Socket.instances[1].open()
  first.onclose?.()
  first.onerror?.()
  expect(connectionStatus.value).toBe('connected')
  vi.advanceTimersByTime(60000)
  expect(Socket.instances).toHaveLength(2)
  Socket.instances[1].close()
  disconnectWebSocket()
  vi.advanceTimersByTime(60000)
  expect(Socket.instances).toHaveLength(2)
})
test('one failing message subscriber does not prevent later subscribers', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const bad = onMessage(() => {
    throw new Error('fixture')
  })
  const handler = vi.fn()
  const good = onMessage(handler)
  initWebSocket()
  Socket.instances[0].onmessage?.({ data: '{"type":"new_trace","payload":{}}' })
  expect(handler).toHaveBeenCalledOnce()
  bad()
  good()
  log.mockRestore()
})
