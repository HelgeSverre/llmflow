import { describe, expect, it } from 'vitest'
import { severity, spanColor, spanType } from './badges'

describe('spanType', () => {
  it('classifies by substring, case-insensitively', () => {
    expect(spanType('LLM')).toBe('llm')
    expect(spanType('agent.run')).toBe('agent')
    expect(spanType('vector_retrieval')).toBe('retrieval')
    expect(spanType('workflow')).toBe('workflow')
  })

  it('falls back to custom', () => {
    expect(spanType(undefined)).toBe('custom')
    expect(spanType('')).toBe('custom')
    expect(spanType('http')).toBe('custom')
  })

  it('picks the first known type when several match', () => {
    expect(spanType('agent_llm')).toBe('llm')
  })

  it('maps to the shared CSS palette', () => {
    expect(spanColor('tool_call')).toBe('var(--span-tool)')
    expect(spanColor(null)).toBe('var(--span-custom)')
  })
})

describe('severity', () => {
  it('normalises OTLP severity text', () => {
    expect(severity('WARNING')).toBe('warn')
    expect(severity('Error')).toBe('error')
    expect(severity('FATAL2')).toBe('fatal')
    expect(severity('DEBUG')).toBe('debug')
    expect(severity('TRACE')).toBe('trace')
  })

  it('defaults to info', () => {
    expect(severity(undefined)).toBe('info')
    expect(severity('NOTICE')).toBe('info')
  })
})
