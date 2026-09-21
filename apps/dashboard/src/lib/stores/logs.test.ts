import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('$lib/api/client', () => ({ api: { get: vi.fn() } }))
vi.mock('./websocket.svelte', () => ({ onMessage: vi.fn() }))
import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'
import {
  clearSelection,
  initLogsSync,
  loadLogs,
  logs,
  logFilters,
  selectLog,
  selectedLog,
  selectedLogId,
} from './logs.svelte'

function pending() {
  let resolve!: (value: unknown) => void
  let reject!: (error: Error) => void
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  vi.mocked(api.get).mockReturnValueOnce(promise)
  return { resolve, reject }
}
beforeEach(() => {
  vi.mocked(api.get).mockReset()
  clearSelection()
  logs.length = 0
  Object.assign(logFilters, { q: '', service_name: '', event_name: '', severity_min: null })
  tabState.current = 'logs'
})

it('ignores a list response for an older filter', async () => {
  const old = pending()
  logFilters.service_name = 'old'
  const first = loadLogs()
  const current = pending()
  logFilters.service_name = 'new'
  const second = loadLogs()
  current.resolve({ logs: [{ id: 'new' }] })
  await second
  old.resolve({ logs: [{ id: 'old' }] })
  await first
  expect(logs.map((row) => row.id)).toEqual(['new'])
})

for (const sameId of [true, false]) {
  for (const fail of [true, false]) {
    it(`ignores obsolete detail ${fail ? 'error' : 'success'} for ${sameId ? 'same' : 'different'} ID`, async () => {
      const old = pending()
      const first = selectLog('a')
      const current = pending()
      const second = selectLog(sameId ? 'a' : 'b')
      current.resolve({ id: 'current' })
      await second
      if (fail) old.reject(new Error('obsolete'))
      else old.resolve({ id: 'old' })
      await first
      expect(selectedLog.value?.id).toBe('current')
      expect(selectedLogId.value).toBe(sameId ? 'a' : 'b')
    })
  }
}
it('deselection invalidates pending detail', async () => {
  const old = pending()
  const first = selectLog('a')
  clearSelection()
  old.resolve({ id: 'old' })
  await first
  expect(selectedLog.value).toBeNull()
  expect(selectedLogId.value).toBeNull()
})

it('teardown removes the live listener and invalidates pending list and detail', async () => {
  let listener: Parameters<typeof onMessage>[0] | undefined
  const unsubscribe = vi.fn(() => {
    listener = undefined
  })
  vi.mocked(onMessage).mockImplementation((callback) => {
    listener = callback
    return unsubscribe
  })
  const stop = initLogsSync()
  listener?.({ type: 'new_log', payload: { id: 'live', service_name: 'app' } })
  expect(logs.map((row) => row.id)).toEqual(['live'])
  const oldList = pending(),
    first = loadLogs()
  const oldDetail = pending(),
    second = selectLog('old')
  stop()
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(listener).toBeUndefined()
  oldList.resolve({ logs: [{ id: 'obsolete' }] })
  oldDetail.resolve({ id: 'obsolete' })
  await Promise.all([first, second])
  expect(logs.map((row) => row.id)).toEqual(['live'])
  expect(selectedLog.value).toBeNull()
})
