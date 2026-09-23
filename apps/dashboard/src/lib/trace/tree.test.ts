import { describe, expect, it } from 'vitest'
import { flattenTraceTree, type TraceTreeSpan } from './tree'

function span(id: string, extra: Partial<TraceTreeSpan> = {}): TraceTreeSpan {
  return {
    id,
    trace_id: 't1',
    parent_id: null,
    timestamp: 100,
    span_name: `span-${id}`,
    duration_ms: 10,
    children: [],
    ...extra,
  }
}

describe('flattenTraceTree', () => {
  it('returns an empty list for an empty tree', () => {
    expect(flattenTraceTree([])).toEqual([])
  })

  it('flattens depth-first in pre-order and maps span fields', () => {
    const tree = [
      span('root', {
        timestamp: 1,
        span_type: 'agent',
        children: [
          span('a', {
            parent_id: 'root',
            timestamp: 2,
            children: [span('a1', { parent_id: 'a' })],
          }),
          span('b', { parent_id: 'root', timestamp: 3 }),
        ],
      }),
    ]
    const flat = flattenTraceTree(tree)
    expect(flat.map((s) => s.id)).toEqual(['root', 'a', 'a1', 'b'])
    expect(flat[0]).toMatchObject({
      id: 'root',
      name: 'span-root',
      start_time: 1,
      duration_ms: 10,
      span_type: 'agent',
      trace_id: 't1',
    })
    expect(flat[1]).toMatchObject({ parent_id: 'root', start_time: 2 })
    for (const s of flat) {
      expect(s).not.toHaveProperty('children')
      expect(s).not.toHaveProperty('timestamp')
      expect(s).not.toHaveProperty('span_name')
    }
  })

  it('maps a null parent_id to undefined and falls back to the id when the name is missing', () => {
    const [flat] = flattenTraceTree([span('x', { span_name: null, duration_ms: null })])
    expect(flat.parent_id).toBeUndefined()
    expect(flat.name).toBe('x')
    expect(flat.duration_ms).toBeNull()
  })

  it('keeps several roots and the parent_id of orphans whose parent is missing', () => {
    // A partial trace: spans whose parent never arrived come back as extra
    // roots that still point at the missing parent.
    const tree = [
      span('root'),
      span('orphan', {
        parent_id: 'missing',
        children: [span('child', { parent_id: 'orphan' })],
      }),
    ]
    const flat = flattenTraceTree(tree)
    expect(flat.map((s) => [s.id, s.parent_id])).toEqual([
      ['root', undefined],
      ['orphan', 'missing'],
      ['child', 'orphan'],
    ])
  })

  it('flags ancestors of failed descendants but not the failed span itself', () => {
    const tree = [
      span('root', {
        children: [
          span('mid', {
            parent_id: 'root',
            children: [span('leaf', { parent_id: 'mid', error: 'boom' })],
          }),
          span('ok', { parent_id: 'root' }),
        ],
      }),
    ]
    const byId = Object.fromEntries(flattenTraceTree(tree).map((s) => [s.id, s]))
    expect(byId.root.has_child_error).toBe(true)
    expect(byId.mid.has_child_error).toBe(true)
    expect(byId.leaf.has_child_error).toBe(false)
    expect(byId.leaf.error).toBe('boom')
    expect(byId.ok.has_child_error).toBe(false)
  })

  it.each([
    [399, false],
    [400, true],
    [500, true],
    ['503', true],
    [null, false],
  ])('treats a child with status %s as failed: %s', (status, failed) => {
    const [root] = flattenTraceTree([
      span('root', { children: [span('c', { parent_id: 'root', status })] }),
    ])
    expect(root.has_child_error).toBe(failed)
  })
})
