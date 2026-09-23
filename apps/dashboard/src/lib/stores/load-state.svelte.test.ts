import { beforeEach, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
vi.mock('$lib/api/client', () => ({ api: { get: vi.fn() } }))
import { api } from '$lib/api/client'
import { createLoadState } from './load-state.svelte'
import { loadModels, modelStats, modelsState } from './models.svelte'

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
  Object.assign(modelsState, { loading: false, loaded: false, error: '' })
  modelStats.length = 0
})

it('starts idle and gives every caller its own state', () => {
  const a = createLoadState()
  const b = createLoadState()
  expect(a).toEqual({ loading: false, loaded: false, error: '' })
  a.loading = true
  expect(b.loading).toBe(false)
})

it('is reactive', () => {
  const state = createLoadState()
  const seen: boolean[] = []
  const cleanup = $effect.root(() => {
    $effect(() => {
      seen.push(state.loading)
    })
  })
  flushSync()
  state.loading = true
  flushSync()
  state.loading = false
  flushSync()
  cleanup()
  expect(seen).toEqual([false, true, false])
})

it('goes idle -> loading -> loaded on success', async () => {
  const request = pending()
  const done = loadModels()
  expect(modelsState).toEqual({ loading: true, loaded: false, error: '' })
  request.resolve([{ model: 'gpt' }])
  await done
  expect(modelsState).toEqual({ loading: false, loaded: true, error: '' })
  expect(modelStats.map((m) => m.model)).toEqual(['gpt'])
})

it('goes loading -> error on failure, keeps loaded, and clears the error on the next success', async () => {
  const first = pending()
  const ok = loadModels()
  first.resolve([])
  await ok

  const failing = pending()
  const failed = loadModels()
  expect(modelsState.loading).toBe(true)
  failing.reject(new Error('boom'))
  await failed
  expect(modelsState).toEqual({ loading: false, loaded: true, error: 'Could not load models.' })

  const retry = pending()
  const retried = loadModels()
  retry.resolve([])
  await retried
  expect(modelsState).toEqual({ loading: false, loaded: true, error: '' })
})

it('stays loading until the latest request settles and ignores stale outcomes', async () => {
  const old = pending()
  const first = loadModels()
  const current = pending()
  const second = loadModels()

  old.reject(new Error('stale'))
  await first
  expect(modelsState).toEqual({ loading: true, loaded: false, error: '' })

  current.resolve([{ model: 'new' }])
  await second
  expect(modelsState).toEqual({ loading: false, loaded: true, error: '' })
  expect(modelStats.map((m) => m.model)).toEqual(['new'])
})
