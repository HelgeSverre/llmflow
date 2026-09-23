// OTLP/JSON carries IDs as hex, LLMFlow's own IDs are UUIDs; both are stored as bare lowercase hex.
export function normalizeId(id: string | null | undefined): string | null {
    if (!id) return null
    return id.replace(/-/g, '').toLowerCase()
}

// OTLP export needs exact-width IDs: 32 hex chars for traces, 16 for spans.
export function fixedWidthId(id: string | null | undefined, width: 32 | 16): string {
    const clean = normalizeId(id) ?? ''
    return clean.length >= width ? clean.slice(0, width) : clean.padStart(width, '0')
}

// OTLP/protobuf decodes bytes fields as base64 strings.
export function base64IdToHex(id: string): string {
    return Buffer.from(id, 'base64').toString('hex')
}
