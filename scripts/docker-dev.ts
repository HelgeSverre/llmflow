import { spawn } from 'node:child_process'
import { root } from './dev-runtime'

const args = ['compose', '-f', `${root}/docker/docker-compose.yml`]
let env = { ...process.env }
let active: ReturnType<typeof spawn> | undefined
let stopping = false
async function run(command: string[], capture = false) {
    let output = ''
    const child = spawn('docker', [...args, ...command], {
        cwd: root,
        env,
        stdio: ['inherit', 'pipe', 'pipe'],
    })
    active = child
    child.stdout!.on('data', (data) => {
        output += data
        if (!capture) process.stdout.write(data)
    })
    child.stderr!.on('data', (data) => {
        output += data
        if (!capture) process.stderr.write(data)
    })
    const code = await new Promise<number>((resolve) => {
        child.once('error', (error) => {
            output += error.message
            resolve(1)
        })
        child.once('close', (code) => resolve(code ?? 1))
    })
    if (active === child) active = undefined
    return { code, output }
}
async function stop() {
    if (stopping) return
    stopping = true
    active?.kill('SIGTERM')
    const timeout = setTimeout(() => process.exit(1), 10000)
    await run(['stop'])
    clearTimeout(timeout)
    process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
let result = await run(['up', '--build', '-d'], true)
if (
    result.code &&
    /port is already allocated|address already in use|failed to bind host port/i.test(result.output)
) {
    console.log('[llmflow] Docker host ports are busy; requesting available ports from Docker.')
    env = { ...env, DASHBOARD_PORT: '0', PROXY_PORT: '0' }
    result = await run(['up', '--build', '-d'], true)
}
if (result.code) {
    console.error(result.output)
    process.exitCode = result.code
} else if (!stopping) {
    process.stdout.write(result.output)
    for (const [label, port] of [
        ['Dashboard/OTLP', '1337'],
        ['Proxy', '8080'],
    ]) {
        const address = await run(['port', 'llmflow', port!], true)
        if (address.code) console.error(address.output)
        else console.log(`[llmflow] ${label}: http://${address.output.trim()}`)
    }
    const logs = await run(['logs', '--follow'])
    if (!stopping) process.exitCode = logs.code
}
