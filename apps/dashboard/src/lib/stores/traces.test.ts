import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/api/client', () => ({ api: { get: vi.fn() } }))
vi.mock('./websocket.svelte', () => ({ onMessage: vi.fn(() => () => {}) }))

import { api } from '$lib/api/client'
import { clearSelection, selectedTrace, selectedTraceId, selectTrace } from './traces.svelte'

function deferred() {
  let resolve!: (value: unknown) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function request() {
  const detail = deferred()
  const tree = deferred()
  vi.mocked(api.get).mockReturnValueOnce(detail.promise).mockReturnValueOnce(tree.promise)
  return {
    resolve(id: string) {
      detail.resolve({ trace: { id } })
      tree.resolve({ spans: [] })
    },
    reject() {
      detail.reject(new Error('obsolete'))
      tree.resolve({ spans: [] })
    },
  }
}

beforeEach(() => {
  clearSelection()
  vi.mocked(api.get).mockReset()
})

describe('trace selection ordering', () => {
  for (const sameId of [false, true]) {
    for (const reject of [false, true]) {
      it(`ignores obsolete ${reject ? 'failure' : 'success'} for ${sameId ? 'same' : 'different'} ID`, async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const old = request()
        const first = selectTrace('a')
        const current = request()
        const second = selectTrace(sameId ? 'a' : 'b')
        current.resolve('new')
        await second
        if (reject) old.reject()
        else old.resolve('old')
        await first
        expect(selectedTrace.value?.trace.id).toBe('new')
        expect(selectedTraceId.value).toBe(sameId ? 'a' : 'b')
        log.mockRestore()
      })
    }
  }

  it('invalidates pending requests on deselection, even if the same ID is selected again', async () => {
    const old = request()
    const first = selectTrace('a')
    clearSelection()
    old.resolve('old')
    await first
    expect(selectedTrace.value).toBeNull()
    expect(selectedTraceId.value).toBeNull()
  })
})

import { loadTraces, traces, traceFilters, initTracesSync } from './traces.svelte'
import { tabState } from './tabs.svelte'
import { onMessage } from './websocket.svelte'

it('old list responses cannot overwrite a newer filtered query', async () => {
  tabState.current = 'traces'
  const old = deferred(),
    current = deferred()
  vi.mocked(api.get).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
  traceFilters.model = 'old'
  const first = loadTraces()
  traceFilters.model = 'new'
  const second = loadTraces()
  current.resolve([{ id: 'new' }])
  await second
  old.resolve([{ id: 'old' }])
  await first
  expect(traces.map((trace) => trace.id)).toEqual(['new'])
})
it('live updates reload the active filtered query once and clean up pending refreshes', async () => {
  vi.useFakeTimers()
  tabState.current = 'traces'
  traceFilters.model = 'fixture'
  traceFilters.q = 'needle'
  traceFilters.status = 'error'
  traceFilters.dateRange = '1h'
  const stop = initTracesSync()
  const handler = vi.mocked(onMessage).mock.calls.at(-1)![0]
  vi.mocked(api.get).mockResolvedValue([{ id: 'matching' }])
  handler({ type: 'new_trace', payload: { id: 'nonmatching' } })
  handler({ type: 'new_span', payload: { id: 'another' } })
  await vi.advanceTimersByTimeAsync(100)
  expect(api.get).toHaveBeenCalledOnce()
  const url = vi.mocked(api.get).mock.calls[0][0]
  expect(url).toContain('q=needle')
  expect(url).toContain('model=fixture')
  expect(url).toContain('status=error')
  expect(url).toContain('date_from=')
  expect(traces.map((trace) => trace.id)).toEqual(['matching'])
  handler({ type: 'new_trace', payload: {} })
  stop()
  await vi.advanceTimersByTimeAsync(100)
  expect(api.get).toHaveBeenCalledOnce()
  vi.useRealTimers()
})
