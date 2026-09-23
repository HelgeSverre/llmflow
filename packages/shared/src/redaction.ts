const SENSITIVE =
    /authorization|cookie|api[-_]?key|(?:^|[-_])(?:token|secret|password|credential)(?:$|[-_])|helicone-auth/i

type HeaderInput = Headers | Record<string, string> | null | undefined

export function sanitizeHeaders(headers: HeaderInput): Record<string, string> {
    const entries = headers instanceof Headers ? headers.entries() : Object.entries(headers || {})
    return Object.fromEntries(
        Array.from(entries, ([key, value]) => [key, SENSITIVE.test(key) ? '[REDACTED]' : value]),
    )
}

export function sanitizePath<T extends string | null | undefined>(value: T): T | string {
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
