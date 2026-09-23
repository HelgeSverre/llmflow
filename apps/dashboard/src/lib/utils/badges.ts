const SPAN_TYPES = ['llm', 'agent', 'chain', 'tool', 'retrieval', 'embedding', 'workflow'] as const

export type SpanType = (typeof SPAN_TYPES)[number] | 'custom'

export function spanType(raw?: string | null): SpanType {
  const lower = raw?.toLowerCase() ?? ''
  return SPAN_TYPES.find((type) => lower.includes(type)) ?? 'custom'
}

export function spanColor(raw?: string | null): string {
  return `var(--span-${spanType(raw)})`
}

const SEVERITIES = ['fatal', 'error', 'warn', 'debug', 'trace'] as const

export type Severity = (typeof SEVERITIES)[number] | 'info'

export function severity(text?: string | null): Severity {
  const lower = text?.toLowerCase() ?? ''
  return SEVERITIES.find((level) => lower.includes(level)) ?? 'info'
}
