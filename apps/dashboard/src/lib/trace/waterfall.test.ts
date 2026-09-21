import { afterEach, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import Harness from './__fixtures__/WaterfallHarness.svelte'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

it('updates props without remounting or resizing and clamps long-to-empty scroll state', async () => {
  let resize: () => void = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  const component = mount(Harness, { target: document.body })
  flushSync(() =>
    component.update(
      Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        name: `span ${i}`,
        start_time: 0,
        duration_ms: 100,
      })),
    ),
  )
  const axis = document.querySelector('.axis-bar-area')!
  vi.spyOn(axis, 'getBoundingClientRect').mockReturnValue({ width: 320 } as DOMRect)
  const scroll = document.querySelector('.waterfall') as HTMLElement
  Object.defineProperty(scroll, 'clientHeight', { value: 200 })
  flushSync(resize)
  expect((document.querySelector('.span-bar') as HTMLElement).style.width).toBe('320px')
  scroll.scrollTop = 2400
  flushSync(() => scroll.dispatchEvent(new Event('scroll')))
  flushSync(() =>
    component.update([{ id: 'next', name: 'new span', start_time: 50, duration_ms: 25 }], 'b'),
  )
  expect(document.querySelector('[role="treeitem"]')?.textContent).toContain('new span')
  expect((document.querySelector('.span-bar') as HTMLElement).style.width).toBe('320px')
  expect(scroll.scrollTop).toBe(0)
  flushSync(() => component.update([], 'b'))
  expect(document.querySelectorAll('[role="treeitem"]')).toHaveLength(0)
  expect((document.querySelector('.row-list') as HTMLElement).style.paddingBottom).toBe('0px')
  await unmount(component)
})
