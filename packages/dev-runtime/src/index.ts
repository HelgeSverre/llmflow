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
export function port(name: string, fallback: number) {
    const value = Number(process.env[name] ?? fallback)
    if (!Number.isInteger(value) || value < 0 || value > 65535)
        throw new Error(`${name} must be a port from 0 to 65535`)
    return value
}
export function available<T>(label: string, preferred: number, listen: (port: number) => T): T {
    try {
        return listen(preferred)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || preferred === 0) throw error
        log.warn(`${label} port ${preferred} is busy; choosing an available port.`)
        return listen(0)
    }
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
export function clientUrl(url: URL) {
    const copy = new URL(url)
    if (['0.0.0.0', '[::]'].includes(copy.hostname)) copy.hostname = '127.0.0.1'
    return copy.origin
}
export function frontendOrigins() {
    return runtimes()
        .filter((runtime) => runtime.kind === 'frontend')
        .flatMap(({ url }) => {
            const value = new URL(url)
            const origins = [value.origin]
            if (['127.0.0.1', 'localhost', '[::1]'].includes(value.hostname))
                for (const host of ['127.0.0.1', 'localhost', '[::1]'])
                    origins.push(`http://${host}:${value.port}`)
            return origins
        })
}
