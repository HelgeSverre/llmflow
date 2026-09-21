export function trustedWebSocketOrigin(request: Request, hostname: string, port: number): boolean {
    const value = request.headers.get('origin')
    if (!value || value === 'null') return false
    let origin: URL
    try {
        origin = new URL(value)
    } catch {
        return false
    }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== value) return false
    const hosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
    if (!['0.0.0.0', '::'].includes(hostname))
        hosts.add(hostname.includes(':') ? `[${hostname}]` : hostname)
    const allowed = new Set(Array.from(hosts, (host) => `http://${host}:${port}`))
    for (const entry of (process.env.WS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        try {
            const configured = new URL(entry)
            if (['http:', 'https:'].includes(configured.protocol) && configured.origin === entry)
                allowed.add(entry)
        } catch {
            /* Ignore invalid configuration entries. */
        }
    }
    return allowed.has(value)
}
