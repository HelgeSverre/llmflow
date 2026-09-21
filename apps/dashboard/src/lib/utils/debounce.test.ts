import { afterEach, expect, it, vi } from 'vitest'
import { createDebounce } from './debounce'

afterEach(() => vi.useRealTimers())

it('only runs the latest callback, supports repeated cancellation and rescheduling', () => {
  vi.useFakeTimers()
  const debounce = createDebounce(300)
  const first = vi.fn(),
    last = vi.fn()
  debounce.schedule(first)
  vi.advanceTimersByTime(200)
  debounce.schedule(last)
  vi.advanceTimersByTime(299)
  expect(first).not.toHaveBeenCalled()
  expect(last).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(last).toHaveBeenCalledOnce()
  debounce.schedule(first)
  debounce.cancel()
  debounce.cancel()
  vi.advanceTimersByTime(300)
  expect(first).not.toHaveBeenCalled()
  debounce.schedule(first)
  vi.advanceTimersByTime(300)
  expect(first).toHaveBeenCalledOnce()
})
