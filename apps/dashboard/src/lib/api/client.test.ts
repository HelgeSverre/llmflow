import { afterEach, expect, it, vi } from 'vitest'
import { api } from './client'

afterEach(() => vi.unstubAllGlobals())

it('returns the parsed JSON body of a successful response', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: 1 }))
  vi.stubGlobal('fetch', fetch)
  await expect(api.get('/api/stats')).resolves.toEqual({ ok: 1 })
  expect(fetch).toHaveBeenCalledWith('/api/stats')
})

it('throws with the status code for a non-OK response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })))
  await expect(api.get('/api/stats')).rejects.toThrow('API error: 503')
})

it('propagates network errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(api.get('/api/stats')).rejects.toThrow('Failed to fetch')
})
