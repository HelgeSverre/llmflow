// Okabe-Ito 8-color palette — chosen for color-blind safety + perceptual
// distinguishability. See docs/reference/trace-span-viewer-ui/04 §Color encoding.
export const SPAN_COLORS: Record<string, string> = {
  llm: '#0072B2', // blue
  agent: '#D55E00', // vermillion
  chain: '#009E73', // bluish green
  tool: '#F0E442', // yellow
  retrieval: '#56B4E9', // sky blue
  embedding: '#CC79A7', // reddish purple
  workflow: '#E69F00', // orange
  custom: '#999999', // grey
}

export function colorFor(spanType?: string): string {
  if (!spanType) return SPAN_COLORS.custom
  const lower = spanType.toLowerCase()
  for (const key of Object.keys(SPAN_COLORS)) {
    if (lower.includes(key)) return SPAN_COLORS[key]
  }
  return SPAN_COLORS.custom
}
