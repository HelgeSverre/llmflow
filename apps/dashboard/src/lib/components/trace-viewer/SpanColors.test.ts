import { expect, it } from 'vitest'
import { SPAN_COLORS, colorFor } from './SpanColors'

it('uses the custom colour when the span type is missing or unknown', () => {
  expect(colorFor()).toBe(SPAN_COLORS.custom)
  expect(colorFor('')).toBe(SPAN_COLORS.custom)
  expect(colorFor('something-else')).toBe(SPAN_COLORS.custom)
})

it('matches known span types case-insensitively and by substring', () => {
  for (const [type, color] of Object.entries(SPAN_COLORS)) {
    expect(colorFor(type)).toBe(color)
    expect(colorFor(type.toUpperCase())).toBe(color)
  }
  expect(colorFor('openai.llm.call')).toBe(SPAN_COLORS.llm)
  expect(colorFor('ToolCall')).toBe(SPAN_COLORS.tool)
})

it('picks the first palette key when a type contains several', () => {
  expect(colorFor('agent_llm')).toBe(SPAN_COLORS.llm)
})
