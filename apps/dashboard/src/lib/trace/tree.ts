import type { SpanInput } from './viewport.svelte'

export interface TraceTreeSpan {
  id: string
  trace_id: string | null
  parent_id: string | null
  timestamp: number
  span_name: string | null
  duration_ms: number | null
  span_type?: string
  children: TraceTreeSpan[]
  [key: string]: unknown
}

export interface TraceTree {
  trace?: { partial?: boolean; missing_parent_ids?: string[] }
  spans: TraceTreeSpan[]
}

export function flattenTraceTree(nodes: TraceTreeSpan[]): SpanInput[] {
  const spans: SpanInput[] = []
  const failed = (node: TraceTreeSpan): boolean =>
    !!node.error || Number(node.status) >= 400 || node.children.some(failed)
  const walk = (node: TraceTreeSpan) => {
    const { children, timestamp, span_name, ...detail } = node
    spans.push({
      ...detail,
      has_child_error: children.some(failed),
      id: node.id,
      parent_id: node.parent_id ?? undefined,
      name: span_name || node.id,
      start_time: timestamp,
      duration_ms: node.duration_ms,
    })
    children.forEach(walk)
  }
  nodes.forEach(walk)
  return spans
}
