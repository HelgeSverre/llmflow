function extractAnyValue(value) {
    if (!value) return null
    if (value.stringValue !== undefined) return value.stringValue
    if (value.intValue !== undefined) return Number(value.intValue)
    if (value.doubleValue !== undefined) return value.doubleValue
    if (value.boolValue !== undefined) return value.boolValue
    if (value.bytesValue !== undefined) return value.bytesValue
    if (value.arrayValue) return (value.arrayValue.values || []).map(extractAnyValue)
    if (value.kvlistValue) return extractAttributes(value.kvlistValue.values)
    return null
}

function extractAttributes(attrs) {
    if (!Array.isArray(attrs)) return {}
    return Object.fromEntries(
        attrs.filter((attr) => attr?.value).map(({ key, value }) => [key, extractAnyValue(value)]),
    )
}

module.exports = { extractAttributes, extractAnyValue }
