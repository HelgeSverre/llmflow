// Networking helpers shared by the server, dev scripts, tests and the Playwright config.
// Only node: built-ins here: playwright.config.ts loads this file under plain Node.
import { createServer } from 'node:net'

export const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]']
const WILDCARD_HOSTS = ['0.0.0.0', '::', '[::]']

/** The host a client should use to reach a listener bound to `hostname`. */
export function clientHost(hostname: string): string {
    if (WILDCARD_HOSTS.includes(hostname)) return '127.0.0.1'
    return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname
}

/** The origin a client should use for a server URL (wildcard binds become 127.0.0.1). */
export function clientUrl(url: URL | string): string {
    const copy = new URL(url)
    copy.hostname = clientHost(copy.hostname)
    return copy.origin
}

/** A port that was free a moment ago. Prefer binding port 0 directly where the API allows it. */
export async function freePort(): Promise<number> {
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    if (!address || typeof address === 'string') throw new Error('No free port assigned')
    return address.port
}

/** Polls `check` until it returns a truthy value, or throws `message` after `timeout` ms. */
export async function waitUntil<T>(
    check: () => T | Promise<T>,
    message: string,
    timeout = 20_000,
    interval = 50,
): Promise<T> {
    const end = Date.now() + timeout
    while (Date.now() < end) {
        const result = await check()
        if (result) return result
        await new Promise((resolve) => setTimeout(resolve, interval))
    }
    throw new Error(message)
}

/** Waits until `${baseUrl}/api/health` answers 2xx. */
export function waitForHealth(baseUrl: string, timeout = 20_000): Promise<true> {
    return waitUntil(
        async () => {
            try {
                return (await fetch(`${baseUrl}/api/health`)).ok || null
            } catch {
                return null
            }
        },
        `${baseUrl} did not become healthy within ${timeout}ms`,
        timeout,
        100,
    ) as Promise<true>
}
