import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('$lib/api/client', () => ({ api: { get: vi.fn() } }))
import { api } from '$lib/api/client'
import { loadSession, loadSessions, sessionsState } from './sessions.svelte'

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
  sessionsState.selected = null
  sessionsState.error = null
  sessionsState.loading = false
})

for (const sameId of [false, true]) {
  for (const fail of [false, true]) {
    for (const oldFirst of [false, true]) {
      it(`ignores obsolete ${fail ? 'failure' : 'success'} for ${sameId ? 'same' : 'different'} session, finishing ${oldFirst ? 'first' : 'last'}`, async () => {
        const old = pending()
        const first = loadSession('a')
        const current = pending()
        const second = loadSession(sameId ? 'a' : 'b')
        const settleOld = async () => {
          if (fail) old.reject(new Error('obsolete'))
          else old.resolve({ session_id: 'old' })
          await first
        }
        if (oldFirst) {
          await settleOld()
          expect(sessionsState.loading).toBe(true)
          expect(sessionsState.selected).toBeNull()
          expect(sessionsState.error).toBeNull()
        }
        current.resolve({ session_id: 'current' })
        await second
        if (!oldFirst) await settleOld()
        expect(sessionsState.selected?.session_id).toBe('current')
        expect(sessionsState.error).toBeNull()
        expect(sessionsState.loading).toBe(false)
      })
    }
  }
}

it('retains the current failure when an obsolete request later succeeds', async () => {
  const old = pending()
  const first = loadSession('a')
  const current = pending()
  const second = loadSession('b')
  current.reject(new Error('current failure'))
  await second
  old.resolve({ session_id: 'old' })
  await first
  expect(sessionsState.selected).toBeNull()
  expect(sessionsState.error).toBe('current failure')
  expect(sessionsState.loading).toBe(false)
})

it('live refresh retains the requested page while pagination is pending', async () => {
  sessionsState.offset = 0
  const old = pending()
  const first = loadSessions(50, 50)
  const current = pending()
  const second = loadSessions()
  expect(api.get).toHaveBeenLastCalledWith('/api/sessions?limit=50&offset=50')
  current.resolve({ sessions: [{ session_id: 'page-two' }], total: 100 })
  await second
  old.resolve({ sessions: [{ session_id: 'obsolete' }], total: 100 })
  await first
  expect(sessionsState.offset).toBe(50)
  expect(sessionsState.list[0].session_id).toBe('page-two')
})
