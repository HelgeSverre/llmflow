const SENSITIVE =
    /authorization|cookie|api[-_]?key|(?:^|[-_])(?:token|secret|password|credential)(?:$|[-_])|helicone-auth/i

function sanitizeHeaders(headers) {
    const entries = headers instanceof Headers ? headers.entries() : Object.entries(headers || {})
    return Object.fromEntries(
        Array.from(entries, ([key, value]) => [key, SENSITIVE.test(key) ? '[REDACTED]' : value]),
    )
}

function sanitizePath(value) {
    if (!value) return value
    try {
        const url = new URL(value, 'http://redaction.invalid')
        for (const key of new Set(url.searchParams.keys())) {
            if (SENSITIVE.test(key) || key.toLowerCase() === 'key')
                url.searchParams.set(key, '[REDACTED]')
        }
        return url.pathname + url.search
    } catch {
        return '[INVALID URL]'
    }
}

module.exports = { sanitizeHeaders, sanitizePath }
