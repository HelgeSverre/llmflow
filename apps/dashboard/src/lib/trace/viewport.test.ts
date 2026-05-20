import { describe, it, expect } from 'vitest'
import { TraceViewport, type SpanInput } from './viewport.svelte'

const trace: SpanInput[] = [
    { id: 'root', parent_id: undefined, name: 'root', start_time: 0, duration_ms: 100, span_type: 'agent' },
    { id: 'a', parent_id: 'root', name: 'llm-call', start_time: 10, duration_ms: 40, span_type: 'llm' },
    { id: 'b', parent_id: 'root', name: 'tool-use', start_time: 60, duration_ms: 30, span_type: 'tool' }
]

describe('TraceViewport', () => {
    it('flattens the tree depth-first', () => {
        const v = new TraceViewport(trace)
        expect(v.rows.map(r => r.id)).toEqual(['root', 'a', 'b'])
    })

    it('computes pixel ranges relative to the root duration', () => {
        const v = new TraceViewport(trace)
        v.setViewportWidth(1000)  // total = 100ms → 10px per ms
        const a = v.rows.find(r => r.id === 'a')!
        expect(a.xPx).toBe(100)        // start_time 10ms × 10
        expect(a.widthPx).toBe(400)    // duration 40ms × 10
    })

    it('expand/collapse hides descendants', () => {
        const v = new TraceViewport(trace)
        v.collapse('root')
        expect(v.rows.map(r => r.id)).toEqual(['root'])
        v.expand('root')
        expect(v.rows.map(r => r.id)).toEqual(['root', 'a', 'b'])
    })

    it('selectedId updates and is observable', () => {
        const v = new TraceViewport(trace)
        v.select('a')
        expect(v.selectedId).toBe('a')
        expect(v.selectedSpan?.name).toBe('llm-call')
    })

    it('handles an empty span list without infinities', () => {
        const v = new TraceViewport([])
        v.setViewportWidth(1000)
        expect(v.rows).toEqual([])
        expect(v.rootStart).toBe(0)
        expect(v.totalDuration).toBe(1)
        expect(v.selectedSpan).toBeNull()
    })

    it('treats orphan spans (parent_id pointing to nothing) as roots', () => {
        const orphans: SpanInput[] = [
            { id: 'a', parent_id: 'missing-parent', name: 'a', start_time: 0, duration_ms: 10 },
            { id: 'b', parent_id: undefined, name: 'b', start_time: 20, duration_ms: 10 }
        ]
        const v = new TraceViewport(orphans)
        expect(v.rows.map(r => r.id).sort()).toEqual(['a', 'b'])
        expect(v.rows.every(r => r.depth === 0)).toBe(true)
    })
})
