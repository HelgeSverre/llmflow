import { createHash } from 'node:crypto'
import {
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir, userInfo } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { log } from '@llmflow/shared/logger'
import { LOOPBACK_HOSTS } from '@llmflow/shared/net'

// Keyed by checkout so split dev commands in one clone find each other and ignore other clones.
const checkout = path.resolve(
    realpathSync(fileURLToPath(new URL('.', import.meta.url))),
    '../../..',
)
export const stateDirectory =
    process.env.LLMFLOW_DEV_STATE_DIR ||
    path.join(
        tmpdir(),
        `llmflow-dev-${userInfo().uid}-${createHash('sha256').update(checkout).digest('hex').slice(0, 16)}`,
    )
export interface Runtime {
    pid: number
    started: number
    kind: 'backend' | 'frontend'
    url: string
    proxy?: string
}
// Development only: when the preferred port is busy, listen on any free port instead.
// `listen` may throw (Bun.serve) or return a rejecting promise (node:http).
export function available<T>(label: string, preferred: number, listen: (port: number) => T): T {
    const busy = (error: unknown) =>
        (error as NodeJS.ErrnoException).code === 'EADDRINUSE' && preferred !== 0
    const fallback = () => {
        log.warn(`${label} port ${preferred} is busy; choosing an available port.`)
        return listen(0)
    }
    let result: T
    try {
        result = listen(preferred)
    } catch (error) {
        if (!busy(error)) throw error
        return fallback()
    }
    if (result instanceof Promise)
        return result.catch((error: unknown) => {
            if (!busy(error)) throw error
            return fallback()
        }) as T
    return result
}
export function publish(runtime: Omit<Runtime, 'pid' | 'started'>) {
    mkdirSync(stateDirectory, { recursive: true, mode: 0o700 })
    const file = path.join(stateDirectory, `${runtime.kind}-${process.pid}.json`)
    const temporary = `${file}.tmp`
    writeFileSync(
        temporary,
        JSON.stringify({ ...runtime, pid: process.pid, started: Date.now() }),
        { mode: 0o600 },
    )
    renameSync(temporary, file)
    return () => rmSync(file, { force: true })
}
export function runtimes(): Runtime[] {
    try {
        return readdirSync(stateDirectory)
            .filter((file) => file.endsWith('.json'))
            .flatMap((file) => {
                try {
                    const value = JSON.parse(
                        readFileSync(path.join(stateDirectory, file), 'utf8'),
                    ) as Runtime
                    if (
                        !Number.isInteger(value.pid) ||
                        value.pid <= 0 ||
                        !['backend', 'frontend'].includes(value.kind)
                    )
                        return []
                    process.kill(value.pid, 0)
                    if (new URL(value.url).protocol !== 'http:') return []
                    return [value]
                } catch {
                    return []
                }
            })
            .sort((a, b) => b.started - a.started)
    } catch {
        return []
    }
}
export function backendUrl() {
    if (process.env.LLMFLOW_URL) return process.env.LLMFLOW_URL.replace(/\/$/, '')
    return runtimes().find((runtime) => runtime.kind === 'backend')?.url
}
export function frontendOrigins() {
    return runtimes()
        .filter((runtime) => runtime.kind === 'frontend')
        .flatMap(({ url }) => {
            const value = new URL(url)
            const origins = [value.origin]
            if (LOOPBACK_HOSTS.includes(value.hostname))
                for (const host of LOOPBACK_HOSTS) origins.push(`http://${host}:${value.port}`)
            return origins
        })
}
