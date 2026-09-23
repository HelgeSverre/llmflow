import { LOOPBACK_HOSTS, clientHost } from '@llmflow/shared/net'

export function trustedWebSocketOrigin(
    request: Request,
    hostname: string,
    port: number,
    extraOrigins: string[] = [],
): boolean {
    const value = request.headers.get('origin')
    if (!value || value === 'null') return false
    let origin: URL
    try {
        origin = new URL(value)
    } catch {
        return false
    }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== value) return false
    // A wildcard bind is reachable through loopback only; a specific bind also through its own host.
    const hosts = new Set([...LOOPBACK_HOSTS, clientHost(hostname)])
    const allowed = new Set(Array.from(hosts, (host) => `http://${host}:${port}`))
    for (const entry of [
        ...extraOrigins,
        ...(process.env.WS_ALLOWED_ORIGINS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    ]) {
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
