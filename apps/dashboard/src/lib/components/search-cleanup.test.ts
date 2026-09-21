import { afterEach, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
vi.mock('$lib/api/client', () => ({ api: { get: vi.fn(async () => []) } }))
vi.mock('$lib/stores/websocket.svelte', () => ({ onMessage: vi.fn(() => vi.fn()) }))
import { api } from '$lib/api/client'
import { onMessage } from '$lib/stores/websocket.svelte'
import { tabState } from '$lib/stores/tabs.svelte'
import TracesTab from './traces/TracesTab.svelte'
import LogsTab from './logs/LogsTab.svelte'
import TimelineTab from './timeline/TimelineTab.svelte'

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
  vi.clearAllMocks()
})

for (const [tab, Component] of [
  ['traces', TracesTab],
  ['logs', LogsTab],
  ['timeline', TimelineTab],
] as const) {
  it(`${tab} cancels pending search and removes its live listener on unmount`, async () => {
    vi.useFakeTimers()
    tabState.current = tab
    const component = mount(Component, { target: document.body })
    flushSync()
    await Promise.resolve()
    const input = document.querySelector('input') as HTMLInputElement
    input.value = 'pending search'
    flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })))
    const unsubscribe = vi.mocked(onMessage).mock.results.at(-1)!.value
    await unmount(component)
    vi.mocked(api.get).mockClear()
    await vi.advanceTimersByTimeAsync(400)
    expect(api.get).not.toHaveBeenCalled()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
}
