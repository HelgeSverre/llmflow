import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatCost,
  formatExactCost,
  formatLatency,
  formatNumber,
  formatTime,
  formatTimestamp,
  plural,
} from './format'

afterEach(() => vi.useRealTimers())

describe('formatNumber', () => {
  it.each([
    [null, '-'],
    [undefined, '-'],
    [0, '0'],
    [999, '999'],
    [1_000, '1.0K'],
    [1_250, '1.3K'],
    [999_999, '1000.0K'],
    [1_000_000, '1.0M'],
    [12_345_678, '12.3M'],
  ])('%s -> %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected)
  })
})

describe('formatCost', () => {
  it.each([
    [null, '-'],
    [undefined, '-'],
    [0, '$0.00'],
    [0.001, '<$0.01'],
    [0.01, '$0.01'],
    [1.234, '$1.23'],
    [42, '$42.00'],
  ])('%s -> %s', (input, expected) => {
    expect(formatCost(input)).toBe(expected)
  })
})

describe('formatLatency', () => {
  it.each([
    [null, '-'],
    [undefined, '-'],
    [0, '0ms'],
    [12.6, '13ms'],
    [999, '999ms'],
    [1000, '1.0s'],
    [2540, '2.5s'],
  ])('%s -> %s', (input, expected) => {
    expect(formatLatency(input)).toBe(expected)
  })
})

describe('formatExactCost', () => {
  it.each([
    [null, '—'],
    [undefined, '—'],
    [0, '$0.00'],
    [0.000000001, '<$0.00000001'],
    [-0.000000001, '<$0.00000001'],
    [0.00000001, '$0.00000001'],
    [0.123456789, '$0.12345679'],
    [0.5, '$0.50'],
    [1234.5, '$1,234.50'],
  ])('%s -> %s', (input, expected) => {
    expect(formatExactCost(input)).toBe(expected)
  })
})

describe('formatTime', () => {
  it('shows only the time for timestamps from today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 18, 0, 0))
    const out = formatTime(new Date(2026, 0, 15, 9, 5, 7).getTime())
    expect(out).toMatch(/09:05:07/)
    expect(out).not.toMatch(/Jan/)
  })

  it('includes the date for older timestamps and accepts strings', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 18, 0, 0))
    const out = formatTime(new Date(2026, 0, 3, 9, 5).toISOString())
    expect(out).toMatch(/Jan 3/)
    expect(out).toMatch(/09:05/)
  })
})

describe('formatTimestamp', () => {
  it('includes the date, the time and a time zone name', () => {
    const out = formatTimestamp(new Date(2026, 0, 3, 9, 5).getTime())
    expect(out).toMatch(/^1\/3\/2026, 9:05:00\s?AM \S+$/)
  })
})

describe('plural', () => {
  it.each([
    [0, 'span', '0 spans'],
    [1, 'span', '1 span'],
    [2, 'span', '2 spans'],
    [1500, 'log', '1,500 logs'],
  ])('%s %s -> %s', (value, noun, expected) => {
    expect(plural(value, noun)).toBe(expected)
  })
})
